import { PartialType } from '@nestjs/swagger';
import { CreateCategoriePrestationDto } from './create-categorie-prestation.dto.js';

export class UpdateCategoriePrestationDto extends PartialType(
  CreateCategoriePrestationDto,
) {}
