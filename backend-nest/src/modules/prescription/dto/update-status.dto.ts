import { IsIn, IsString } from 'class-validator';

const VALID_STATUSES = ['UPLOADED', 'CLAIMED', 'PROCESSING', 'RENDERED', 'SENT'] as const;

export class UpdateStatusDto {
  @IsString()
  @IsIn(VALID_STATUSES, { message: `status must be one of: ${VALID_STATUSES.join(', ')}` })
  status: string;
}
