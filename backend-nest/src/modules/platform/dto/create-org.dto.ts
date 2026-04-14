import { IsString, IsNotEmpty, IsEmail, IsOptional, IsIn, MinLength } from 'class-validator';

export class CreateOrgDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  org_name: string;

  @IsOptional()
  @IsString()
  @IsIn(['FREE', 'PRO', 'GROWTH', 'ENT', 'ENTERPRISE'])
  plan?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  admin_name: string;

  @IsEmail()
  admin_email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  admin_password: string;

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
