import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateRenderDto {
  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(2048)
  video_url?: string;
}
