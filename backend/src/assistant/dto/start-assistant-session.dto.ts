import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StartAssistantSessionDto {
  @ApiProperty({ example: 1, description: 'ID de la societe ciblee' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId: number;

  @ApiProperty({
    example: 'Bonjour, je veux un devis isolation.',
    required: false,
    description: 'Message initial optionnel du prospect',
  })
  @IsOptional()
  @IsString()
  initialMessage?: string;
}
