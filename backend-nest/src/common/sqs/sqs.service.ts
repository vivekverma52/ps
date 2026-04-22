import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
  GetQueueAttributesCommand,
  type Message,
} from '@aws-sdk/client-sqs';

// ── Constants ────────────────────────────────────────────────────────────────

const LONG_POLL_WAIT_SECONDS  = 20;
const MAX_MESSAGES_PER_BATCH  = 10;
const BASE_RETRY_DELAY_MS     = 1_000;   // 1 s — exponential backoff base
const MAX_RETRY_DELAY_MS      = 60_000;  // cap at 60 s
const AUTH_ERROR_DELAY_MS     = 5 * 60_000; // 5 min — no point hammering on bad creds
const MAX_HANDLER_RETRIES     = 3;       // per-message handler retries before giving up
const VISIBILITY_EXTENSION_S  = 60;      // extend visibility while handler retries

// Auth/config errors that will never self-heal — back off long instead of retrying every 60 s
const PERMANENT_ERROR_CODES = new Set([
  'InvalidClientTokenId',
  'ExpiredTokenException',
  'AccessDeniedException',
  'AuthFailure',
  'InvalidSignatureException',
]);

// ── Types ────────────────────────────────────────────────────────────────────

export type SqsMessageHandler = (
  body: Record<string, unknown>,
  meta: SqsMessageMeta,
) => Promise<void>;

export interface SqsMessageMeta {
  messageId:     string;
  receiptHandle: string;
  queueUrl:      string;
  receiveCount:  number;
  sentAt:        Date | null;
}

interface QueueState {
  active:       boolean;
  consecutiveErrors: number;
  messagesProcessed: number;
  messagesErrored:   number;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class SqsService implements OnModuleDestroy {
  private readonly logger = new Logger(SqsService.name);
  private readonly sqs: SQSClient;
  private readonly queues = new Map<string, QueueState>();

  constructor(private readonly configService: ConfigService) {
    const region           = this.configService.get<string>('AWS_REGION');
    const accessKeyId      = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey  = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    const missing = [
      !region           && 'AWS_REGION',
      !accessKeyId      && 'AWS_ACCESS_KEY_ID',
      !secretAccessKey  && 'AWS_SECRET_ACCESS_KEY',
    ].filter(Boolean);

    if (missing.length) {
      this.logger.error(
        `[SQS] Missing required env vars: ${missing.join(', ')} — SQS will not function`,
      );
    }

    this.sqs = new SQSClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 3, // SDK-level retry for transient AWS errors
    });

    this.logger.log(`[SQS] Client initialised — region=${region}`);
  }

  // ── PUBLIC: Producer ───────────────────────────────────────────────────────

  /**
   * Send a single message to the given queue.
   * Throws on failure — callers are responsible for handling the error.
   */
  async sendMessage(
    queueUrl: string,
    body: Record<string, unknown>,
    opts: { deduplicationId?: string; groupId?: string } = {},
  ): Promise<void> {
    const serialised = JSON.stringify(body);

    this.logger.debug(
      `[SQS:Producer] Sending to ${this.queueLabel(queueUrl)} — ` +
      `size=${serialised.length}B payload=${this.truncate(serialised, 200)}`,
    );

    try {
      const cmd = new SendMessageCommand({
        QueueUrl:               queueUrl,
        MessageBody:            serialised,
        MessageDeduplicationId: opts.deduplicationId,
        MessageGroupId:         opts.groupId,
      });

      const res = await this.sqs.send(cmd);

      this.logger.log(
        `[SQS:Producer] Message sent — queue=${this.queueLabel(queueUrl)} ` +
        `messageId=${res.MessageId}`,
      );
    } catch (err: any) {
      this.logger.error(
        `[SQS:Producer] Send failed — queue=${this.queueLabel(queueUrl)} ` +
        `error=${err.name}: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ── PUBLIC: Consumer ───────────────────────────────────────────────────────

  /**
   * Start a long-polling consumer on the given queue URL.
   * Each message is processed by `handler`; the message is only deleted on success.
   * Failed messages are retried up to MAX_HANDLER_RETRIES times before being
   * left in the queue (or sent to a DLQ if one is configured on the queue side).
   */
  startPolling(queueUrl: string, handler: SqsMessageHandler): void {
    if (!queueUrl?.trim()) {
      this.logger.warn('[SQS:Consumer] Queue URL is empty — skipping consumer registration');
      return;
    }

    if (this.queues.has(queueUrl)) {
      this.logger.warn(
        `[SQS:Consumer] Already polling ${this.queueLabel(queueUrl)} — skipping duplicate`,
      );
      return;
    }

    const state: QueueState = {
      active: true,
      consecutiveErrors: 0,
      messagesProcessed: 0,
      messagesErrored: 0,
    };
    this.queues.set(queueUrl, state);

    this.logger.log(
      `[SQS:Consumer] Polling started — queue=${this.queueLabel(queueUrl)} ` +
      `waitTime=${LONG_POLL_WAIT_SECONDS}s batchSize=${MAX_MESSAGES_PER_BATCH}`,
    );

    // Validate DLQ is configured — warn loudly if missing so ops can act before messages are lost
    void this.validateDlqConfigured(queueUrl);

    // Fire-and-forget; the loop manages its own lifecycle via state.active
    void this.pollLoop(queueUrl, handler, state);
  }

  /**
   * Checks whether the given queue has a Redrive Policy (DLQ) configured.
   * Logs a warning if not — this is non-blocking but important for ops visibility.
   * Messages that exceed MAX_HANDLER_RETRIES are left in the queue indefinitely
   * without a DLQ, causing infinite reprocessing.
   */
  private async validateDlqConfigured(queueUrl: string): Promise<void> {
    try {
      const res = await this.sqs.send(
        new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ['RedrivePolicy', 'VisibilityTimeout'],
        }),
      );
      const attrs          = res.Attributes ?? {};
      const redrivePolicy  = attrs['RedrivePolicy'];
      const visibilityTimeout = parseInt(attrs['VisibilityTimeout'] ?? '30', 10);

      if (!redrivePolicy) {
        this.logger.warn(
          `[SQS:DLQ] ⚠️  No Dead Letter Queue configured on queue=${this.queueLabel(queueUrl)}. ` +
          `Messages exceeding ${MAX_HANDLER_RETRIES} handler retries will loop in the queue forever. ` +
          `Configure a DLQ with maxReceiveCount=${MAX_HANDLER_RETRIES + 1} in the AWS console.`,
        );
      } else {
        this.logger.log(
          `[SQS:DLQ] DLQ configured — queue=${this.queueLabel(queueUrl)} policy=${redrivePolicy}`,
        );
      }

      if (visibilityTimeout < VISIBILITY_EXTENSION_S) {
        this.logger.warn(
          `[SQS:DLQ] Queue visibility timeout (${visibilityTimeout}s) is less than ` +
          `VISIBILITY_EXTENSION_S (${VISIBILITY_EXTENSION_S}s) on queue=${this.queueLabel(queueUrl)}. ` +
          `Messages may reappear to other consumers during retry processing.`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `[SQS:DLQ] Could not check DLQ config for queue=${this.queueLabel(queueUrl)}: ${err.message}`,
      );
    }
  }

  // ── PUBLIC: Stats ──────────────────────────────────────────────────────────

  /**
   * Fetch approximate message counts from AWS for a given queue.
   * Useful for health-check / metrics endpoints.
   */
  async getQueueDepth(queueUrl: string): Promise<{
    visible: number; notVisible: number; delayed: number;
  } | null> {
    try {
      const res = await this.sqs.send(
        new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: [
            'ApproximateNumberOfMessages',
            'ApproximateNumberOfMessagesNotVisible',
            'ApproximateNumberOfMessagesDelayed',
          ],
        }),
      );
      const attrs = res.Attributes ?? {};
      return {
        visible:    parseInt(attrs.ApproximateNumberOfMessages            ?? '0', 10),
        notVisible: parseInt(attrs.ApproximateNumberOfMessagesNotVisible  ?? '0', 10),
        delayed:    parseInt(attrs.ApproximateNumberOfMessagesDelayed     ?? '0', 10),
      };
    } catch (err: any) {
      this.logger.warn(
        `[SQS:Stats] Could not fetch queue depth for ${this.queueLabel(queueUrl)}: ${err.message}`,
      );
      return null;
    }
  }

  /** Return in-process consumer stats for all registered queues. */
  getConsumerStats(): Record<string, Omit<QueueState, 'active'> & { active: boolean }> {
    const result: ReturnType<typeof this.getConsumerStats> = {};
    for (const [url, state] of this.queues) {
      result[this.queueLabel(url)] = { ...state };
    }
    return result;
  }

  // ── LIFECYCLE ──────────────────────────────────────────────────────────────

  onModuleDestroy(): void {
    this.logger.log(`[SQS] Shutting down — stopping ${this.queues.size} consumer(s)`);
    for (const [url, state] of this.queues) {
      state.active = false;
      this.logger.log(
        `[SQS:Consumer] Stopped — queue=${this.queueLabel(url)} ` +
        `processed=${state.messagesProcessed} errored=${state.messagesErrored}`,
      );
    }
    this.queues.clear();
  }

  // ── PRIVATE: Poll loop ─────────────────────────────────────────────────────

  private async pollLoop(
    queueUrl: string,
    handler: SqsMessageHandler,
    state: QueueState,
  ): Promise<void> {
    while (state.active) {
      try {
        const result = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl:              queueUrl,
            MaxNumberOfMessages:   MAX_MESSAGES_PER_BATCH,
            WaitTimeSeconds:       LONG_POLL_WAIT_SECONDS,
            AttributeNames:        ['All'],
            MessageAttributeNames: ['All'],
          }),
        );

        const messages = result.Messages ?? [];

        if (messages.length === 0) {
          // Empty poll — reset consecutive error counter, continue silently
          state.consecutiveErrors = 0;
          continue;
        }

        this.logger.debug(
          `[SQS:Consumer] Received ${messages.length} message(s) — queue=${this.queueLabel(queueUrl)}`,
        );

        // Process messages concurrently within the batch
        await Promise.all(
          messages.map((msg) => this.processMessage(msg, queueUrl, handler, state)),
        );

        state.consecutiveErrors = 0;

      } catch (err: any) {
        if (!state.active) break; // Graceful shutdown — not an error

        state.consecutiveErrors++;

        if (PERMANENT_ERROR_CODES.has(err.name)) {
          // Auth/config error — will never self-heal on retry. Back off for 5 min,
          // then try again in case credentials were rotated in the environment.
          this.logger.error(
            `[SQS:Consumer] Permanent auth error on queue=${this.queueLabel(queueUrl)}: ` +
            `${err.name} — ${err.message}. ` +
            `Fix AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY and restart. ` +
            `Pausing ${AUTH_ERROR_DELAY_MS / 1000}s before next attempt.`,
          );
          await this.sleep(AUTH_ERROR_DELAY_MS);
        } else {
          const delay = this.backoffDelay(state.consecutiveErrors);
          this.logger.error(
            `[SQS:Consumer] Poll error (attempt ${state.consecutiveErrors}) — ` +
            `queue=${this.queueLabel(queueUrl)} error=${err.name}: ${err.message} ` +
            `retryIn=${delay}ms`,
            err.stack,
          );
          await this.sleep(delay);
        }
      }
    }

    this.logger.log(`[SQS:Consumer] Poll loop exited — queue=${this.queueLabel(queueUrl)}`);
  }

  // ── PRIVATE: Per-message processing ───────────────────────────────────────

  private async processMessage(
    msg: Message,
    queueUrl: string,
    handler: SqsMessageHandler,
    state: QueueState,
  ): Promise<void> {
    const messageId     = msg.MessageId ?? 'unknown';
    const receiptHandle = msg.ReceiptHandle ?? '';
    const receiveCount  = parseInt(msg.Attributes?.ApproximateReceiveCount ?? '1', 10);
    const sentAt        = msg.Attributes?.SentTimestamp
      ? new Date(parseInt(msg.Attributes.SentTimestamp, 10))
      : null;

    const meta: SqsMessageMeta = {
      messageId, receiptHandle, queueUrl, receiveCount, sentAt,
    };

    const ageMs = sentAt ? Date.now() - sentAt.getTime() : null;

    this.logger.log(
      `[SQS:Consumer] Processing message — queue=${this.queueLabel(queueUrl)} ` +
      `messageId=${messageId} receiveCount=${receiveCount}` +
      (ageMs !== null ? ` ageMs=${ageMs}` : ''),
    );

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(msg.Body ?? '{}') as Record<string, unknown>;
    } catch {
      this.logger.error(
        `[SQS:Consumer] Invalid JSON body — messageId=${messageId} ` +
        `body=${this.truncate(msg.Body ?? '', 300)} — deleting unprocessable message`,
      );
      // Delete poison pill — can't ever parse it
      await this.safeDelete(queueUrl, receiptHandle, messageId);
      state.messagesErrored++;
      return;
    }

    const startMs = Date.now();
    let attempt   = 0;

    while (attempt < MAX_HANDLER_RETRIES) {
      attempt++;
      try {
        await handler(body, meta);

        const durationMs = Date.now() - startMs;
        this.logger.log(
          `[SQS:Consumer] Message handled successfully — ` +
          `queue=${this.queueLabel(queueUrl)} messageId=${messageId} ` +
          `attempt=${attempt} durationMs=${durationMs}`,
        );

        await this.safeDelete(queueUrl, receiptHandle, messageId);
        state.messagesProcessed++;
        return;

      } catch (err: any) {
        const durationMs = Date.now() - startMs;

        if (attempt < MAX_HANDLER_RETRIES) {
          const retryDelay = this.backoffDelay(attempt);
          this.logger.warn(
            `[SQS:Consumer] Handler error — will retry ` +
            `(${attempt}/${MAX_HANDLER_RETRIES}) — ` +
            `queue=${this.queueLabel(queueUrl)} messageId=${messageId} ` +
            `error=${err.name}: ${err.message} retryIn=${retryDelay}ms`,
          );

          // Extend visibility so the message doesn't re-appear to other consumers
          await this.safeExtendVisibility(queueUrl, receiptHandle, messageId, VISIBILITY_EXTENSION_S);
          await this.sleep(retryDelay);
        } else {
          this.logger.error(
            `[SQS:Consumer] Handler failed after ${MAX_HANDLER_RETRIES} attempts — ` +
            `leaving in queue for DLQ — ` +
            `queue=${this.queueLabel(queueUrl)} messageId=${messageId} ` +
            `durationMs=${durationMs} error=${err.name}: ${err.message}`,
            err.stack,
          );
          state.messagesErrored++;
        }
      }
    }
  }

  // ── PRIVATE: SQS helpers ───────────────────────────────────────────────────

  private async safeDelete(
    queueUrl: string,
    receiptHandle: string,
    messageId: string,
  ): Promise<void> {
    try {
      await this.sqs.send(
        new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: receiptHandle }),
      );
      this.logger.debug(
        `[SQS:Consumer] Message deleted — queue=${this.queueLabel(queueUrl)} messageId=${messageId}`,
      );
    } catch (err: any) {
      // Non-fatal — message will re-appear after visibility timeout
      this.logger.warn(
        `[SQS:Consumer] Delete failed (non-fatal) — ` +
        `queue=${this.queueLabel(queueUrl)} messageId=${messageId} ` +
        `error=${err.name}: ${err.message}`,
      );
    }
  }

  private async safeExtendVisibility(
    queueUrl: string,
    receiptHandle: string,
    messageId: string,
    seconds: number,
  ): Promise<void> {
    try {
      await this.sqs.send(
        new ChangeMessageVisibilityCommand({
          QueueUrl:          queueUrl,
          ReceiptHandle:     receiptHandle,
          VisibilityTimeout: seconds,
        }),
      );
    } catch (err: any) {
      this.logger.warn(
        `[SQS:Consumer] Visibility extension failed — ` +
        `queue=${this.queueLabel(queueUrl)} messageId=${messageId} ` +
        `error=${err.name}: ${err.message}`,
      );
    }
  }

  // ── PRIVATE: Utilities ─────────────────────────────────────────────────────

  /** Exponential backoff with jitter, capped at MAX_RETRY_DELAY_MS */
  private backoffDelay(attempt: number): number {
    const exp   = Math.min(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
    const jitter = Math.random() * 0.2 * exp; // ±20% jitter
    return Math.floor(exp + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Extract just the queue name from the full URL for readable logs */
  private queueLabel(queueUrl: string): string {
    return queueUrl?.split('/').pop() ?? queueUrl;
  }

  private truncate(s: string, maxLen: number): string {
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  }
}
