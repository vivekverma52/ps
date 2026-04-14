import { IsOptional, IsString } from 'class-validator';

export class UpdateDoctorProfileDto {
  @IsOptional()
  @IsString()
  hospital_id?: string;

  @IsOptional()
  @IsString()
  role_id?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  license_number?: string;

  @IsOptional()
  @IsString()
  registration_number?: string;
}
