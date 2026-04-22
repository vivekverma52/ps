import { IsIn, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

const VALID_STATUSES = ['UPLOADED', 'CLAIMED', 'PROCESSING', 'RENDERED', 'SENT'] as const;

export class ListPrescriptionsQueryDto {
  @IsOptional() @IsNumberString() page?: string;
  @IsOptional() @IsNumberString() limit?: string;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsIn(VALID_STATUSES) status?: string;
}
