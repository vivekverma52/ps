import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly templateName: string;
  private readonly templateLang: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID', '');
    this.accessToken   = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN', '');
    this.templateName  = this.configService.get<string>('WHATSAPP_VIDEO_TEMPLATE_NAME', 'prescription_video_ready');
    this.templateLang  = this.configService.get<string>('WHATSAPP_VIDEO_TEMPLATE_LANG', 'en_US');

    this.enabled = !!(this.phoneNumberId && this.accessToken);
    if (!this.enabled) {
      this.logger.warn('[WhatsApp] WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not set — WhatsApp dispatch disabled');
    } else {
      this.logger.log(`[WhatsApp] Configured — phoneNumberId=${this.phoneNumberId}, template=${this.templateName}`);
    }
  }

  /**
   * Normalise an Indian phone number to E.164 format (91XXXXXXXXXX).
   * Handles: 10-digit, +91 prefix, 0 prefix, and already-normalised 12-digit.
   */
  private normalisePhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10)                             return `91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    if (digits.length === 11 && digits.startsWith('0'))  return `91${digits.slice(1)}`;
    if (digits.length === 13 && digits.startsWith('091')) return `91${digits.slice(3)}`;
    return null;
  }

  /**
   * Send the prescription_video_ready template to the patient.
   * {{1}} = patient name, {{2}} = video share URL
   *
   * Errors are caught and logged — never thrown — so a WhatsApp failure
   * never rolls back the SQS video-result handler.
   */
  async sendVideoReady(
    rawPhone: string,
    patientName: string,
    videoUrl: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.enabled) {
      this.logger.warn('[WhatsApp] Skipping sendVideoReady — service not configured');
      return { success: false, error: 'not_configured' };
    }

    const to = this.normalisePhone(rawPhone);
    if (!to) {
      this.logger.warn(`[WhatsApp] Cannot normalise phone="${rawPhone}" — skipping`);
      return { success: false, error: 'invalid_phone' };
    }

    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: this.templateName,
        language: { code: this.templateLang },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: patientName },
              { type: 'text', text: videoUrl },
            ],
          },
        ],
      },
    });

    return new Promise((resolve) => {
      const options: https.RequestOptions = {
        hostname: 'graph.facebook.com',
        path: `/v19.0/${this.phoneNumberId}/messages`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            this.logger.log(`[WhatsApp] Sent to ${to} — status=${res.statusCode}`);
            resolve({ success: true });
          } else {
            this.logger.error(`[WhatsApp] API error status=${res.statusCode} body=${data}`);
            resolve({ success: false, error: `http_${res.statusCode}` });
          }
        });
      });

      req.on('error', (err) => {
        this.logger.error(`[WhatsApp] Request failed: ${err.message}`);
        resolve({ success: false, error: err.message });
      });

      req.write(payload);
      req.end();
    });
  }
}
