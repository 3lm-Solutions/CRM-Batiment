import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSavTicketNoteDto {
  @ApiProperty({ example: 'Le chef de chantier doit programmer une visite sur site.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  contenu!: string;
}
