import { PartialType } from '@nestjs/swagger';
import { CreateSousTraitantDto } from './create-sous-traitant.dto.js';

export class UpdateSousTraitantDto extends PartialType(CreateSousTraitantDto) {}
