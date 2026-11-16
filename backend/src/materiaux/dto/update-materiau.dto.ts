import { PartialType } from '@nestjs/swagger';
import { CreateMateriauDto } from './create-materiau.dto.js';

export class UpdateMateriauDto extends PartialType(CreateMateriauDto) {}
