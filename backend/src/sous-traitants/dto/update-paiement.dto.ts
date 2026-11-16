import { PartialType } from '@nestjs/swagger';
import { CreatePaiementDto } from './create-paiement.dto.js';

export class UpdatePaiementDto extends PartialType(CreatePaiementDto) {}
