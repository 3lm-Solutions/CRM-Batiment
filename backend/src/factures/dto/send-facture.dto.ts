import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendFactureDto {
  @ApiPropertyOptional({
    example: 'client@mail.com',
    description: 'Permet de surcharger l email du client pour cet envoi',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'Bonjour, veuillez trouver votre facture en piece jointe PDF.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
