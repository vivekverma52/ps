import { IsString, IsOptional, IsIn, MinLength } from 'class-validator';

export class UpdateOrgDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['FREE', 'PRO', 'GROWTH', 'ENT', 'ENTERPRISE'])
  plan?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  website?: string;
}
