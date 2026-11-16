import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Trim } from '../../../common';
import { SavTicketCategorie } from '../../../generated/prisma/client';

/** After-sales request opened by the client from his online space. */
export class CreateSavClientDto {
  @ApiProperty({ example: 'Le joint de la douche fuit' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titre: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({
    description: 'Chantier concerné (un des vôtres, terminé) — obligatoire depuis le 26/10',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  chantierId?: number;

  @ApiPropertyOptional({ enum: SavTicketCategorie })
  @IsOptional()
  @IsEnum(SavTicketCategorie)
  categorie?: SavTicketCategorie;
}

export class NoteSavClientDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  contenu: string;
}
