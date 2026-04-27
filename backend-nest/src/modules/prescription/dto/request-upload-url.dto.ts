import { IsString, IsNotEmpty, IsIn } from 'class-validator';

const ALLOWED_MIMETYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'application/pdf',
] as const;

export class RequestUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsIn(ALLOWED_MIMETYPES)
  mimetype: string;
}
