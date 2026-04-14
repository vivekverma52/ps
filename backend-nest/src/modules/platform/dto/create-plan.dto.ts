import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePlanDto {
  @IsEnum(['FREE', 'PRO', 'GROWTH', 'ENT'])
  name: 'FREE' | 'PRO' | 'GROWTH' | 'ENT';

  @IsString()
  display_name: string;

  @IsNumber()
  @Min(1)
  rx_limit: number;

  @IsNumber()
  @Min(1)
  team_limit: number;

  @IsNumber()
  @Min(1)
  hospital_limit: number;

  @IsOptional()
  @IsNumber()
  price_monthly?: number;

  @IsOptional()
  features?: Record<string, any>;
}
