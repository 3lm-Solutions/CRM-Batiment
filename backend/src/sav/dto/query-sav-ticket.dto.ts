import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import {
  SavTicketCategorie,
  SavTicketPriorite,
  SavTicketStatut,
} from '../../../generated/prisma/client.js';

export class QuerySavTicketDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'fissure' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: SavTicketStatut })
  @IsOptional()
  @IsEnum(SavTicketStatut)
  statut?: SavTicketStatut;

  @ApiPropertyOptional({ enum: SavTicketPriorite })
  @IsOptional()
  @IsEnum(SavTicketPriorite)
  priorite?: SavTicketPriorite;

  @ApiPropertyOptional({ enum: SavTicketCategorie })
  @IsOptional()
  @IsEnum(SavTicketCategorie)
  categorie?: SavTicketCategorie;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedToId?: number;
}
