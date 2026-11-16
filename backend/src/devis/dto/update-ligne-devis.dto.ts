import { PartialType } from '@nestjs/swagger';
import { CreateLigneDevisDto } from './create-ligne-devis.dto.js';

export class UpdateLigneDevisDto extends PartialType(CreateLigneDevisDto) {}
