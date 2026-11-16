import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/client.js';

export class CreateUserDto {
  @ApiProperty({
    example: 'user@batiment.fr',
    description: "Email de l'utilisateur",
  })
  @IsEmail({}, { message: "L'email doit être valide" })
  @IsNotEmpty({ message: "L'email est obligatoire" })
  email: string;

  @ApiProperty({ example: 'Dupont', description: 'Nom de famille' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  nom: string;

  @ApiProperty({ example: 'Jean', description: 'Prénom' })
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire' })
  prenom: string;

  @ApiProperty({
    enum: Role,
    example: Role.TECHNICO,
    description: "Rôle de l'utilisateur",
  })
  @IsEnum(Role, {
    message:
      'Le rôle doit être valide (ADMIN, TECHNICO, ASSISTANTE, CHEF_CHANTIER, SOUS_TRAITANT)',
  })
  @IsNotEmpty({ message: 'Le rôle est obligatoire' })
  role: Role;

  @ApiPropertyOptional({
    example: '0612345678',
    description: 'Numéro de téléphone',
  })
  @IsOptional()
  @IsString()
  telephone?: string;
}
