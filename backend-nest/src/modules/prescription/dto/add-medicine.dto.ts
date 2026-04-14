import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AddMedicineDto {
  @IsString()
  @IsNotEmpty()
  prescription_id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  quantity?: string;

  @IsString()
  @IsNotEmpty()
  frequency: string;

  @IsString()
  @IsNotEmpty()
  course: string;

  @IsOptional()
  @IsString()
  description?: string;
}
