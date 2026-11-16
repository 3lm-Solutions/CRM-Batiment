import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PaginationQueryDto,
  ToIntArray,
  ToStringArray,
  Trim,
  TrimOrNull,
} from '../../../../common';
import { DevisStatut } from '../../../../generated/prisma/client';

export class CreateDevisDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  clientId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  demandeDevisId?: number;

  @ApiPropertyOptional({ example: 10, description: 'Défaut : TVA de l’entreprise' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  tauxTVA?: number;

  @ApiPropertyOptional({ description: 'Notes internes (jamais montrées au client)' })
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

export class UpdateDevisDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  tauxTVA?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

const SORTABLE = ['reference', 'dateCreation', 'dateEnvoi', 'totalTTC'] as const;
export const DEVIS_SORT_FIELDS = SORTABLE;

export class QueryDevisDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DevisStatut, isArray: true, example: 'ENVOYE,RENVOYE' })
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsEnum(DevisStatut, { each: true })
  statuts?: DevisStatut[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  clientId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  createurId?: number;
}

export class ReviserDevisDto {
  @ApiProperty({ example: 'Le client souhaite un carrelage moins cher' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  justification: string;
}

export class AnnulerDevisDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  motif?: string;
}

export class SignerConseillerDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'Accord verbal du client : le devis passe directement à SIGNE sans signature client en ligne',
  })
  @IsOptional()
  @IsBoolean()
  verbal?: boolean;
}

export class ReordonnerLignesDto {
  @ApiProperty({ type: [Number], description: 'Tous les ids de lignes, dans le nouvel ordre' })
  @ToIntArray()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  ligneIds: number[];
}
