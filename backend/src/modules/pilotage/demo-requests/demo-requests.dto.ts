import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { NormalizeEmail, PaginationQueryDto, ToStringArray, Trim, TrimOrNull, IsPhone } from '../../../common';
import { DemoRequestStatut } from '../../../generated/prisma/client';

export class CreateDemoRequestDto {
  @ApiProperty() @Trim() @IsString() @IsNotEmpty() @MaxLength(100)
  nom: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(100)
  prenom?: string;

  @ApiProperty() @NormalizeEmail() @IsEmail({}, { message: "L'email doit être valide" })
  email: string;

  @ApiPropertyOptional() @IsOptional() @Trim()
  @IsPhone()
  telephone?: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(150)
  entreprise?: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(2000)
  message?: string;

  /** Honeypot: hidden field in the form. Humans leave it empty; bots fill it. */
  @ApiPropertyOptional({ description: 'Laisser vide (anti-robot)' }) @IsOptional() @IsString() @MaxLength(200)
  website?: string;
}

export class QueryDemoRequestsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DemoRequestStatut, isArray: true })
  @IsOptional() @ToStringArray() @IsArray() @IsEnum(DemoRequestStatut, { each: true })
  statuts?: DemoRequestStatut[];
}

export class UpdateDemoRequestDto {
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(1)
  assignedToId?: number | null;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(5000)
  notes?: string | null;
}

export class PlanifierDemoDto {
  @ApiProperty() @IsDateString()
  dateDemo: string;
}
