import { IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class MedicineLibraryQueryDto {
  @IsOptional() @IsNumberString() page?: string;
  @IsOptional() @IsNumberString() limit?: string;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsString() @MaxLength(100) drug_category?: string;
}
