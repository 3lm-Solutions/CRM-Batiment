import { PartialType } from '@nestjs/swagger';
import { CreateDisponibiliteDto } from './create-disponibilite.dto.js';

export class UpdateDisponibiliteDto extends PartialType(CreateDisponibiliteDto) {}
