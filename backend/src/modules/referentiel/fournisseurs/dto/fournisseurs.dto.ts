import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
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

  @ApiPropertyOptional({ example: 'Carrelage, Faïence' }) @IsOptional() @TrimOrNull() @IsString() @MaxLength(300)
  typesMateriaux?: string | null;

  @ApiPropertyOptional({ example: 3, description: 'Délai de livraison en jours' })
  @IsOptional() @IsInt() @Min(0) @Max(365)
  delaiLivraison?: number | null;

  @ApiPropertyOptional({ example: 'Franco 300 € HT — paiement 30 jours' })
  @IsOptional() @TrimOrNull() @IsString() @MaxLength(500)
  conditions?: string | null;
}

export class UpdateFournisseurDto extends PartialType(CreateFournisseurDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  actif?: boolean;
}

export class QueryFournisseursDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @ToBoolean() @IsBoolean()
  actif?: boolean;
}

export class LierCompteFournisseurDto {
  @ApiPropertyOptional({ nullable: true, description: 'Compte FOURNISSEUR (null = délier)' })
  @IsOptional() @IsInt() @Min(1)
  userId: number | null;
}
