import { IsEmail, IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateHospitalMemberDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsIn(['DOCTOR', 'PHARMACIST'], { message: 'role must be DOCTOR or PHARMACIST' })
  role: 'DOCTOR' | 'PHARMACIST';
}
