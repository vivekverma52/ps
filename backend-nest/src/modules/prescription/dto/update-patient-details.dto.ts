import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class UpdatePatientDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  patient_name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s\-()\\.]{7,20}$/, { message: 'Invalid phone number format' })
  patient_phone?: string;
}
