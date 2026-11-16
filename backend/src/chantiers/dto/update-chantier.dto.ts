import { PartialType } from '@nestjs/swagger';
import { CreateChantierDto } from './create-chantier.dto.js';

export class UpdateChantierDto extends PartialType(CreateChantierDto) {}
