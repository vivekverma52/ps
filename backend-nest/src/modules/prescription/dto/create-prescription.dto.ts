import { IsString, IsOptional } from 'class-validator';

export class CreatePrescriptionDto {
  @IsOptional()
  @IsString()
  patient_name?: string;

  @IsOptional()
  @IsString()
  patient_phone?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** S3 key returned by POST /upload-url — set after client uploads directly to S3. */
  @IsOptional()
  @IsString()
  image_key?: string;
}
