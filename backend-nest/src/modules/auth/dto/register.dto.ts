import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  @IsIn(['ADMIN', 'DOCTOR', 'PHARMACIST'])
  role?: string;

  @IsOptional()
  @IsString()
  clinic_name?: string;

}
