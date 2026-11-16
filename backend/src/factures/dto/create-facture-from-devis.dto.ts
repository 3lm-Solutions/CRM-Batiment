import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateFactureFromDevisDto {
  @ApiPropertyOptional({
    enum: ['ACOMPTE', 'FINALE'],
    example: 'FINALE',
  })
  @IsOptional()
  @IsIn(['ACOMPTE', 'FINALE'])
  typeFacture?: 'ACOMPTE' | 'FINALE';

  @ApiPropertyOptional({
    example: 30,
    description: 'Pourcentage d acompte applique sur le total TTC',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  acomptePercent?: number;
}
