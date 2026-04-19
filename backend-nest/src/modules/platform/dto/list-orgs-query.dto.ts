import { IsOptional, IsString } from 'class-validator';

export class ListOrgsQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() plan?: string;
  @IsOptional() @IsString() status?: string;
}
