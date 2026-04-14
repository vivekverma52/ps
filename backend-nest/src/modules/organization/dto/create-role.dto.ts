import { IsString, IsNotEmpty, IsOptional, IsIn, IsBoolean, IsObject } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  display_name: string;

  @IsOptional()
  @IsString()
  @IsIn(['DOCTOR', 'PHARMACIST', 'VIEWER', 'ADMIN'])
  base_role?: string;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, boolean>;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
