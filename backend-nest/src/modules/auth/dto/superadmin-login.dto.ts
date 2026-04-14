import { IsEmail, IsString } from 'class-validator';

export class SuperadminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
