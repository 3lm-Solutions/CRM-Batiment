import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { NormalizeEmail, PaginationQueryDto, ToBoolean, Trim, TrimOrNull, IsPhone } from '../../../../common';

export class CreateFournisseurDto {
  @ApiProperty({ example: 'Point P' })
  @Trim() @IsString() @IsNotEmpty() @MaxLength(150)
  nom: string;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(150)
  contact?: string | null;

  @ApiPropertyOptional({ description: 'Email de commande (bons de commande envoyés ici)' })
  @IsOptional() @NormalizeEmail() @IsEmail()
  email?: string | null;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull()
  @IsPhone()
  telephone?: string | null;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(300)
  adresse?: string | null;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Matériaux du catalogue fournis (remplace la liste ; un matériau déjà chez un autre fournisseur lui est retiré)',
  })
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsInt({ each: true }) @Min(1, { each: true })
  materiauIds?: number[];

  @ApiPropertyOptional({ example: 3, description: 'Délai de livraison en jours' })
  @IsOptional() @IsInt() @Min(0) @Max(365)
  delaiLivraison?: number | null;

  @ApiPropertyOptional({ example: 'Franco 300 € HT — paiement 30 jours' })
  @IsOptional() @TrimOrNull() @IsString() @MaxLength(500)
  conditions?: string | null;

  @ApiPropertyOptional({ description: 'Compte FOURNISSEUR existant à rattacher dès la création (portail)' })
  @IsOptional() @IsInt() @Min(1)
  userId?: number | null;
}

/** The portal account changes through PUT /fournisseurs/:id/compte only. */
export class UpdateFournisseurDto extends PartialType(OmitType(CreateFournisseurDto, ['userId'] as const)) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  actif?: boolean;
}

export class QueryFournisseursDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @ToBoolean() @IsBoolean()
  actif?: boolean;
}

/** « Rattacher des matériaux » (fiche fournisseur, ou depuis une nouvelle commande). */
export class MateriauxFournisseurDto {
  @ApiProperty({ type: [Number] })
  @IsArray() @ArrayMaxSize(1000) @IsInt({ each: true }) @Min(1, { each: true })
  materiauIds: number[];
}

export class LierCompteFournisseurDto {
  @ApiPropertyOptional({ nullable: true, description: 'Compte FOURNISSEUR (null = délier)' })
  @IsOptional() @IsInt() @Min(1)
  userId: number | null;
}
