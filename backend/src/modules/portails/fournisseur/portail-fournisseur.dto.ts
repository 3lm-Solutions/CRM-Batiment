import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto, ToStringArray, TrimOrNull } from '../../../common';
import { CommandeFournisseurStatut } from '../../../generated/prisma/client';

export class QueryCommandesPortailDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CommandeFournisseurStatut, isArray: true })
  @IsOptional() @ToStringArray() @IsArray() @IsEnum(CommandeFournisseurStatut, { each: true })
  statuts?: CommandeFournisseurStatut[];
}

/** Acknowledgement or shipping notice from the supplier. */
export class ReponseFournisseurDto {
  @ApiPropertyOptional({ description: 'Date de livraison annoncée' }) @IsOptional() @IsDateString()
  dateLivraisonPrevue?: string;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(1000)
  commentaire?: string | null;
}
