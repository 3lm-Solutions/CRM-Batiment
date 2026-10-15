import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NormalizeEmail, PaginationQueryDto, ToBoolean, ToStringArray, Trim, TrimOrNull, IsPhone } from '../../../../common';
import { Role } from '../../../../generated/prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'nouveau@batiment-pro.fr' })
  @NormalizeEmail()
  @IsEmail({}, { message: "L'email doit être valide" })
  email: string;

  @ApiProperty({ example: 'Dupont' })
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MaxLength(100)
  nom: string;

  @ApiProperty({ example: 'Jean' })
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire' })
  @MaxLength(100)
  prenom: string;

  @ApiProperty({ enum: Role, example: Role.TECHNICO })
  @IsEnum(Role, { message: `Rôle invalide (${Object.values(Role).join(', ')})` })
  role: Role;

  @ApiPropertyOptional({ example: '0612345678' })
  @IsOptional()
  @Trim()
  @IsPhone()
  telephone?: string;
}

/** `actif` is NOT here: (de)activation has its own endpoints with their own rules. */
export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prenom?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsPhone()
  telephone?: string | null;
}

export class QueryUsersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  actif?: boolean;
}

export class UserOptionsQueryDto {
  @ApiPropertyOptional({ enum: Role, isArray: true, example: ['CHEF_CHANTIER'] })
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Role, { each: true })
  roles?: Role[];
}
