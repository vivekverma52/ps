import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export class CreatePlanDto {
  @IsEnum(['FREE', 'PRO', 'GROWTH', 'ENT'])
  name: 'FREE' | 'PRO' | 'GROWTH' | 'ENT';

  @IsNumber()
  @Min(1)
  max_prescriptions_per_month: number;

  @IsNumber()
  @Min(1)
  max_staff_per_hospital: number;

  @IsNumber()
  @Min(1)
  max_hospitals: number;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  features?: Record<string, any>;
}
