import { PartialType } from '@nestjs/swagger';
import { CreateTypeProjetDto } from './create-type-projet.dto.js';

export class UpdateTypeProjetDto extends PartialType(CreateTypeProjetDto) {}
