import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsPhone, NormalizeEmail, PaginationQueryDto, Trim, TrimOrNull } from '../../../common';
import { DemandeStatut, TypeClient } from '../../../generated/prisma/client';

/** A new contact met on a job site. */
export class NouveauProspectDto {
  @ApiPropertyOptional({ enum: TypeClient, default: TypeClient.PARTICULIER })
  @IsOptional()
  @IsEnum(TypeClient)
  typeClient?: TypeClient;

  @ApiProperty({ example: 'Martin', description: 'Nom, ou raison sociale' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom: string;

  @ApiPropertyOptional({ example: 'Paul' })
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(100)
  prenom?: string | null;

  @ApiPropertyOptional({ example: '06 12 34 56 78' })
  @IsOptional()
  @TrimOrNull()
  @IsPhone()
  telephone?: string | null;

  @ApiPropertyOptional({ example: 'paul.martin@mail.fr' })
  @IsOptional()
  @NormalizeEmail()
  @IsEmail({}, { message: 'Adresse email invalide' })
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ example: '12 rue des Lilas, 69000 Lyon' })
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(300)
  adresse?: string | null;
}

export class CreerProspectTerrainDto {
  @ApiPropertyOptional({ description: 'Client déjà connu (ex. trouvé par /clients/doublons)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  clientId?: number;

  @ApiPropertyOptional({
    type: NouveauProspectDto,
    description: 'Nouveau contact (si pas de clientId)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NouveauProspectDto)
  client?: NouveauProspectDto;

  @ApiProperty({ example: 'Refaire la salle de bain, environ 8 m², douche à l’italienne' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({ description: 'Détails structurés (pièces, surfaces…)' })
  @IsOptional()
  @IsObject()
  besoinStructure?: Record<string, unknown>;

  /** Le téléphone ou l'email existe déjà, mais c'est bien une autre personne */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  creerQuandMeme?: boolean;
}

export class QueryProspectsTerrainDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DemandeStatut })
  @IsOptional()
  @IsEnum(DemandeStatut)
  statut?: DemandeStatut;
}
