import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DemandeStatut } from '../../../generated/prisma/client.js';

export class UpdateStatutDto {
  @ApiProperty({
    enum: DemandeStatut,
    example: DemandeStatut.EN_COURS,
    description: 'Nouveau statut de la demande',
  })
  @IsEnum(DemandeStatut, {
    message: 'Le statut doit être : NOUVEAU, EN_COURS, CONVERTI ou PERDU',
  })
  @IsNotEmpty()
  statut: DemandeStatut;
}
