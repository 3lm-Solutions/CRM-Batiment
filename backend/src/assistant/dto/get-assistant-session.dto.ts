import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class GetAssistantSessionDto {
  @ApiProperty({ example: 1, description: 'ID de la societe ciblee' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId: number;
}
