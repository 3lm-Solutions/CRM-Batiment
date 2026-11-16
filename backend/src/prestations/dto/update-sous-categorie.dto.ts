import { PartialType } from '@nestjs/swagger';
import { CreateSousCategorieDto } from './create-sous-categorie.dto.js';

export class UpdateSousCategorieDto extends PartialType(
  CreateSousCategorieDto,
) {}
