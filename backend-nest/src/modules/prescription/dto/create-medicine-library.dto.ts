import { IsArray, IsOptional, IsString, MaxLength, IsNotEmpty } from 'class-validator';

export class CreateMedicineLibraryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  medicine_name: string;

  @IsString()
  @IsNotEmpty()
  common_usage: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  drug_category: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  generic_name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alternative_medicines?: string[];

  @IsOptional()
  @IsString()
  medicine_image?: string;

  @IsOptional()
  @IsString()
  medicine_image_2?: string;

  @IsOptional()
  @IsString()
  medicine_image_3?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  manufacturer_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  marketer_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  salt_composition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tablet_color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  appearance?: string;
}
