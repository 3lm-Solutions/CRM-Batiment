import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../../common';

export class CreateTacheCommentaireDto {
  @ApiProperty({ example: 'Livraison du carrelage décalée à jeudi.' })
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Le commentaire est vide' })
  @MaxLength(2000)
  texte: string;
}
