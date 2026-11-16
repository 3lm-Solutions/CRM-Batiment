import { PartialType } from '@nestjs/swagger';
import { CreatePrestationDto } from './create-prestation.dto.js';

export class UpdatePrestationDto extends PartialType(CreatePrestationDto) {}
