import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DevisStatut } from '../../../generated/prisma/client.js';

export class UpdateDevisStatutDto {
  @ApiProperty({
    enum: DevisStatut,
    example: DevisStatut.ENVOYE,
    description: 'Nouveau statut du devis',
  })
  @IsEnum(DevisStatut, {
    message:
      'Le statut doit être : BROUILLON, ENVOYE, ACCEPTE, SIGNE, REFUSE, ANNULE, REVISE, RENVOYE',
  })
  @IsNotEmpty()
  statut: DevisStatut;
}
