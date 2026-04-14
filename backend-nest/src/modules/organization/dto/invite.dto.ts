import { IsEmail, IsOptional, IsString, IsIn } from 'class-validator';

export class InviteDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @IsIn(['DOCTOR', 'PHARMACIST'])
  role?: string;

  @IsOptional()
  @IsString()
  custom_role_id?: string;
}
