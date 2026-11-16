import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { FactureLigneInputDto } from './facture-ligne-input.dto.js';

export class UpdateFactureDto {
  @ApiPropertyOptional({ example: 'FAC-2026-0042' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @ApiPropertyOptional({ example: '2026-04-08' })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional({ example: '2026-05-08' })
  @IsOptional()
  @IsISO8601()
  dateEcheance?: string;

  @ApiPropertyOptional({ enum: ['ACOMPTE', 'FINALE'], example: 'FINALE' })
  @IsOptional()
  @IsIn(['ACOMPTE', 'FINALE'])
  typeFacture?: 'ACOMPTE' | 'FINALE';

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  acomptePercent?: number;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  acompteMontant?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tauxTVA?: number;

  @ApiPropertyOptional({ example: 'Batiflow SARL' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyNom?: string;

  @ApiPropertyOptional({ example: 'contact@batiflow.fr' })
  @IsOptional()
  @IsEmail()
  companyEmail?: string;

  @ApiPropertyOptional({ example: '+33 1 01 02 03 04' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  companyTelephone?: string;

  @ApiPropertyOptional({ example: '12 rue de Paris, 75000 Paris' })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  companyAdresse?: string;

  @ApiPropertyOptional({ example: '12345678901234' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  companySiret?: string;

  @ApiPropertyOptional({ example: 'Martin' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nomClient?: string;

  @ApiPropertyOptional({ example: 'Julie' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  prenomClient?: string;

  @ApiPropertyOptional({ example: 'julie.martin@mail.com' })
  @IsOptional()
  @IsEmail()
  emailClient?: string;

  @ApiPropertyOptional({ example: '+33 6 10 20 30 40' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telephoneClient?: string;

  @ApiPropertyOptional({ example: '8 avenue Victor Hugo, 92000 Nanterre' })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  adresseClient?: string;

  @ApiPropertyOptional({ example: 'Paiement a 30 jours fin de mois.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  conditionsPaiement?: string;

  @ApiPropertyOptional({
    example: 'Merci de rappeler FAC-2026-0042 au virement.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(800)
  communicationPaiement?: string;

  @ApiPropertyOptional({ example: 'TVA non applicable, art. 293 B du CGI.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notesLegales?: string;

  @ApiPropertyOptional({ example: 'FAC-2026-0042' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referencePaiement?: string;

  @ApiPropertyOptional({
    type: [FactureLigneInputDto],
    description: 'Remplace la liste complete des lignes facture',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FactureLigneInputDto)
  lignes?: FactureLigneInputDto[];
}
