import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../errors/app.error';

const ALLOWED_UPLOAD_MIMETYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'application/pdf',
]);

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET');
    this.region = this.configService.get<string>('AWS_REGION');

    const required = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET'];
    const missing = required.filter((k) => !this.configService.get(k));
    if (missing.length) {
      this.logger.warn(`[S3] Missing env vars: ${missing.join(', ')} — file uploads will fail`);
    } else {
      this.logger.log(`[S3] Configured — bucket: ${this.bucket}, region: ${this.region}`);
    }

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  async uploadToS3(buffer: Buffer, originalName: string, mimetype: string): Promise<string> {
    const ext = path.extname(originalName).toLowerCase();
    const key = `prescriptions/${uuidv4()}${ext}`; // UUID prevents key collision under concurrent uploads

    this.logger.log(`[S3] Uploading: key=${key}, size=${buffer.length} bytes, type=${mimetype}`);

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
        }),
      );
    } catch (err: any) {
      this.logger.error(`[S3] Upload failed: ${err.name} — ${err.message}`);
      if (err.$metadata) {
        this.logger.error(
          `[S3]    HTTP status: ${err.$metadata.httpStatusCode}, requestId: ${err.$metadata.requestId}`,
        );
      }
      const readable = new AppError(
        `S3 upload failed: ${err.name} — ${err.message}`,
        err.$metadata?.httpStatusCode || 500,
      );
      throw readable;
    }

    this.logger.log(`[S3] Upload successful: key=${key}`);
    return key;
  }

  /** Build the public HTTPS URL from a stored S3 key. */
  getObjectUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /** Generate a pre-signed URL that forces a file download (valid for 5 minutes). */
  async getPresignedDownloadUrl(key: string, downloadFilename: string, expiresIn = 300): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${downloadFilename}"`,
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  /** Generate a pre-signed URL for inline viewing (e.g. WhatsApp video share). Default 72 h. */
  async getPresignedViewUrl(key: string, expiresIn = 72 * 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  /**
   * Generate a pre-signed S3 PUT URL so the client uploads directly to S3.
   * The server never touches the file bytes — zero memory pressure.
   * Returns the key (server-generated, client cannot inject paths) and the URL.
   */
  async getPresignedUploadUrl(
    filename: string,
    mimetype: string,
    expiresIn = 300,
  ): Promise<{ key: string; upload_url: string }> {
    if (!ALLOWED_UPLOAD_MIMETYPES.has(mimetype)) {
      throw new AppError(`File type not allowed: ${mimetype}`, 400, 'INVALID_MIME');
    }
    const ext = path.extname(filename).toLowerCase() || '.jpg';
    const key = `prescriptions/${uuidv4()}${ext}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimetype,
    });
    const upload_url = await getSignedUrl(this.s3, command, { expiresIn });
    this.logger.log(`[S3] Pre-signed upload URL — key=${key} expires=${expiresIn}s`);
    return { key, upload_url };
  }

  /** Delete a single object by key — used for S3 rollback when a downstream DB write fails. */
  async deleteObject(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.log(`[S3] Deleted: key=${key}`);
  }
}
