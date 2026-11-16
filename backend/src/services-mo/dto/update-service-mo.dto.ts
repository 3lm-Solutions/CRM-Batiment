import { PartialType } from '@nestjs/swagger';
import { CreateServiceMoDto } from './create-service-mo.dto.js';

export class UpdateServiceMoDto extends PartialType(CreateServiceMoDto) {}
