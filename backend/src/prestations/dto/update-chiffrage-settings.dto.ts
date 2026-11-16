import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateChiffrageSettingsDto {
  @ApiPropertyOptional({ example: 20, description: 'TVA par défaut (%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  tvaDefaut?: number;

  @ApiPropertyOptional({ example: 'EUR', description: 'Devise par défaut' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  devise?: string;

  @ApiPropertyOptional({ example: 30, description: 'Marge cible (%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  margeCiblePourcent?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Frais fixes de déplacement (par devis)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fraisFixeDeplacement?: number;

  @ApiPropertyOptional({
    example: 0.01,
    description: "Pas d'arrondi des prix (0.01 = centime, 1 = euro)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  pasArrondiPrix?: number;
}
