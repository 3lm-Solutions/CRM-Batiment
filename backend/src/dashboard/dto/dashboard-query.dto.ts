import { IsOptional, IsString } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsString()
  periode?: string;
}