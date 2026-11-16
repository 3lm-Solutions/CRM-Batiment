import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateFactureStatutDto {
  @ApiProperty({
    enum: ['BROUILLON', 'ENVOYEE', 'PAYEE', 'ANNULEE'],
    example: 'ENVOYEE',
  })
  @IsIn(['BROUILLON', 'ENVOYEE', 'PAYEE', 'ANNULEE'])
  statut!: 'BROUILLON' | 'ENVOYEE' | 'PAYEE' | 'ANNULEE';
}
