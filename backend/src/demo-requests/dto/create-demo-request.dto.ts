import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePublicDemoRequestDto {
  @ApiProperty({ example: 'Kallel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nom!: string;

  @ApiPropertyOptional({ example: 'Mariem' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  prenom?: string;

  @ApiProperty({ example: 'mariem@example.com' })
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @ApiPropertyOptional({ example: '+216 23 418 599' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telephone?: string;

  @ApiPropertyOptional({ example: 'Entreprise Demo SARL' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  entreprise?: string;

  @ApiPropertyOptional({ example: 'Je souhaite une démonstration du CRM bâtiment.' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  message?: string;

  @ApiPropertyOptional({ example: 1, description: 'Société cible si connue' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId?: number;
}
