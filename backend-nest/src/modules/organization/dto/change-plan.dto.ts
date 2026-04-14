import { IsNotEmpty, IsString } from 'class-validator';

export class ChangePlanDto {
  @IsString()
  @IsNotEmpty({ message: 'Plan name is required' })
  plan: string;
}
