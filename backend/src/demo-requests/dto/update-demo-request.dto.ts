import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { DemoRequestStatut } from '../../../generated/prisma/client.js';

export class UpdateDemoRequestDto {
  @ApiPropertyOptional({ enum: DemoRequestStatut })
  @IsOptional()
  @IsEnum(DemoRequestStatut)
  statut?: DemoRequestStatut;

  @ApiPropertyOptional({
    example: 2,
    nullable: true,
    description: 'Utilisateur commercial assigné. null permet de retirer l’affectation.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedToId?: number | null;

  @ApiPropertyOptional({
    example: '2026-07-04T14:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  dateContact?: string | null;

  @ApiPropertyOptional({
    example: '2026-07-05T10:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  dateDemo?: string | null;

  @ApiPropertyOptional({ example: 'Client intéressé, rappeler demain.' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;

  @ApiPropertyOptional({ example: 'mariem@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string;

  @ApiPropertyOptional({ example: '+216 23 418 599' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telephone?: string;
}
