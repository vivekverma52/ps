import { IsOptional, IsString } from 'class-validator';

export class UpdatePharmacistProfileDto {
  @IsOptional()
  @IsString()
  hospital_id?: string;

  @IsOptional()
  @IsString()
  role_id?: string;

  @IsOptional()
  @IsString()
  license_number?: string;

  @IsOptional()
  @IsString()
  pharmacy_registration?: string;
}
