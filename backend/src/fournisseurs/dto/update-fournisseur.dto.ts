import { PartialType } from '@nestjs/swagger';
import { CreateFournisseurDto } from './create-fournisseur.dto.js';

export class UpdateFournisseurDto extends PartialType(CreateFournisseurDto) {}
