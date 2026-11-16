import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { TypeMouvementStock } from '../../../generated/prisma/client.js';

export class CreateMouvementStockDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  materiauId: number;

  @ApiProperty({ enum: TypeMouvementStock, example: TypeMouvementStock.ENTREE })
  @IsEnum(TypeMouvementStock)
  type: TypeMouvementStock;

  @ApiProperty({ example: 25 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantite: number;

  @ApiPropertyOptional({ example: 'Réception commande CF-2026-014' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  motif?: string;

  @ApiPropertyOptional({ example: 'CF-2026-014' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}
