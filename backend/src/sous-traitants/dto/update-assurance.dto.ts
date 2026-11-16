import { PartialType } from '@nestjs/swagger';
import { CreateAssuranceDto } from './create-assurance.dto.js';

export class UpdateAssuranceDto extends PartialType(CreateAssuranceDto) {}
