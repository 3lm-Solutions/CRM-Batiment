import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/client.js';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Dupont', description: 'Nom de famille' })
  @IsOptional()
  @IsString()
  nom?: string;

  @ApiPropertyOptional({ example: 'Jean', description: 'Prénom' })
  @IsOptional()
  @IsString()
  prenom?: string;

  @ApiPropertyOptional({ enum: Role, description: "Rôle de l'utilisateur" })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ example: '0612345678', description: 'Téléphone' })
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Compte actif ou désactivé',
  })
  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
