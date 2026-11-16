import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateOptionPrestationDto } from './create-option-prestation.dto.js';

export class UpdateOptionPrestationDto extends PartialType(
  OmitType(CreateOptionPrestationDto, ['prestationId', 'choix'] as const),
) {}
