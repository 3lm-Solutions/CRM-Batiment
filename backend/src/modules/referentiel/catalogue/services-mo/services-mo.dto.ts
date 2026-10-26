import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto, ToBoolean, Trim } from '../../../../common';
import { Unite } from '../../../../generated/prisma/client';

export class CreateServiceMoDto {
  @ApiProperty({ example: 'Pose carrelage sol' })
  @Trim() @IsString() @IsNotEmpty() @MaxLength(150)
  nom: string;

  @ApiPropertyOptional({ enum: Unite, default: Unite.M2 }) @IsOptional() @IsEnum(Unite)
  unite?: Unite;

  @ApiProperty({ example: 25, description: 'Coût HT par unité' })
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  prixUnitaire: number;

  @ApiPropertyOptional({ example: 15, description: 'Unités réalisées par jour' })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  productiviteJour?: number | null;

  @ApiPropertyOptional({ example: 250 }) @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  coutJournalier?: number | null;

  /** Sent by the create form too (default true). Was accepted on update only: every creation failed with 400. */
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  actif?: boolean;
}

export class UpdateServiceMoDto extends PartialType(CreateServiceMoDto) {}

export class QueryServicesMoDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Unite }) @IsOptional() @IsEnum(Unite)
  unite?: Unite;

  @ApiPropertyOptional() @IsOptional() @ToBoolean() @IsBoolean()
  actif?: boolean;
}
