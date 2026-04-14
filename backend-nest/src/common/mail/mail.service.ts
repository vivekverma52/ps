import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.from        = this.configService.get<string>('MAIL_FROM', 'Medscript <noreply@medscript.in>');
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');

    this.transporter = nodemailer.createTransport({
      host:   this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port:   this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER', ''),
        pass: this.configService.get<string>('SMTP_PASS', ''),
      },
    });
  }

  async sendPasswordReset(toEmail: string, userName: string, otp: string, userId?: string): Promise<void> {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9f9f7;border-radius:12px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:#1D9E75;border-radius:10px;">
            <span style="color:#fff;font-weight:700;font-size:16px;">Rx</span>
          </div>
          <p style="font-weight:600;font-size:15px;color:#1a1a1a;margin:10px 0 0;">Medscript</p>
        </div>

        <h2 style="font-size:20px;font-weight:600;color:#1a1a1a;margin:0 0 8px;">Reset your password</h2>
        <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 24px;">
          Hi ${userName}, use the OTP below to reset your Medscript password.
          It expires in <strong>10 minutes</strong>.
        </p>

        <div style="text-align:center;margin:0 0 24px;">
          <span style="display:inline-block;background:#fff;border:2px solid #1D9E75;border-radius:12px;
                       padding:16px 36px;font-size:32px;font-weight:700;letter-spacing:10px;color:#1D9E75;">
            ${otp}
          </span>
        </div>

        <p style="font-size:12px;color:#999;line-height:1.6;margin:0;">
          If you didn't request this, you can safely ignore this email — your password won't change.
        </p>

        <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
        <p style="font-size:11px;color:#bbb;text-align:center;margin:0;">
          © 2026 Askim Technologies Pvt. Ltd.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from:    this.from,
        to:      toEmail,
        subject: 'Your Medscript Password Reset OTP',
        html,
      });
      this.logger.log(`Password reset email sent`, { userId: userId ?? 'unknown' });
    } catch (err: any) {
      this.logger.error(`Failed to send password reset email`, { userId: userId ?? 'unknown', errorMsg: err.message });
      // Do not re-throw — token is already saved in DB.
      // Caller decides whether to surface this error or not.
      throw err;
    }
  }
}
