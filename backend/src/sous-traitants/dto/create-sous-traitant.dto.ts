import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSousTraitantDto {
  @ApiPropertyOptional({
    description: 'Compte utilisateur du portail sous-traitant',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiProperty({ example: 'Plomberie Martin' })
  @IsString()
  nom: string;

  @ApiPropertyOptional({ example: '12345678901234' })
  @IsOptional()
  @IsString()
  siret?: string;

  @ApiPropertyOptional({ example: 'Jean Martin' })
  @IsOptional()
  @IsString()
  contact?: string;

  @ApiPropertyOptional({ example: 'jean@plomberie-martin.fr' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '0612345678' })
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional({ example: '12 rue des artisans, 75001 Paris' })
  @IsOptional()
  @IsString()
  adresse?: string;

  @ApiPropertyOptional({ example: 'Plomberie, Chauffage' })
  @IsOptional()
  @IsString()
  specialite?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
