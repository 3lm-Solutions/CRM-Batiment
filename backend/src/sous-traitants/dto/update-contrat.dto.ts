import { PartialType } from '@nestjs/swagger';
import { CreateContratDto } from './create-contrat.dto.js';

export class UpdateContratDto extends PartialType(CreateContratDto) {}
