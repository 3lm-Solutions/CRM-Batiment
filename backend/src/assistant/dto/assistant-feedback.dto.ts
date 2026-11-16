import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class AssistantFeedbackDto {
  @IsInt()
  companyId: number;

  @IsOptional()
  @IsInt()
  sessionId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  messageExcerpt?: string;

  @IsString()
  @IsIn(['UP', 'DOWN'])
  rating: string;
}
