import { Injectable, LoggerService, Scope } from '@nestjs/common';

export interface LogContext {
  requestId?: string;
  userId?: string;
  orgId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: any;
}

function write(stream: NodeJS.WriteStream, entry: Record<string, any>) {
  stream.write(JSON.stringify(entry) + '\n');
}

@Injectable({ scope: Scope.DEFAULT })
export class AppLogger implements LoggerService {
  private context?: string;

  setContext(context: string) {
    this.context = context;
  }

  // ── Info → stdout ──────────────────────────────────────────────────────

  log(message: string, ctx?: LogContext | string) {
    write(process.stdout, this.build('info', message, ctx));
  }

  // ── Warn → stdout ──────────────────────────────────────────────────────

  warn(message: string, ctx?: LogContext | string) {
    write(process.stdout, this.build('warn', message, ctx));
  }

  // ── Error → stderr ─────────────────────────────────────────────────────

  error(message: string, ctx?: LogContext | string, stack?: string) {
    const entry = this.build('error', message, ctx);
    if (stack) entry.stack = stack;
    write(process.stderr, entry);
  }

  // ── Convenience typed methods ──────────────────────────────────────────

  info(message: string, ctx?: LogContext) {
    this.log(message, ctx);
  }

  http(message: string, ctx: LogContext) {
    write(process.stdout, this.build('http', message, ctx));
  }

  // ── Builder ────────────────────────────────────────────────────────────

  private build(level: string, message: string, ctx?: LogContext | string): Record<string, any> {
    const entry: Record<string, any> = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context ?? 'App',
      message,
    };

    if (typeof ctx === 'string') {
      // NestJS internal calls pass context as second arg string
      entry.context = ctx;
    } else if (ctx && typeof ctx === 'object') {
      Object.assign(entry, ctx);
    }

    return entry;
  }

  // ── NestJS LoggerService stubs ─────────────────────────────────────────

  verbose(message: string, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      write(process.stdout, this.build('verbose', message, context));
    }
  }

  debug(message: string, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      write(process.stdout, this.build('debug', message, context));
    }
  }
}
