import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class UpdateOrgDto {
  @IsString()
  @IsNotEmpty({ message: 'Organization name is required' })
  @MaxLength(255, { message: 'Organization name too long' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Address too long' })
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Phone too long' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Website too long' })
  website?: string;
}
