import { PartialType } from '@nestjs/swagger';
import { FactureLigneInputDto } from './facture-ligne-input.dto.js';

export class UpdateFactureLigneDto extends PartialType(FactureLigneInputDto) {}
