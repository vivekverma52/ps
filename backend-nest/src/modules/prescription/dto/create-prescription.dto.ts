import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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
}
