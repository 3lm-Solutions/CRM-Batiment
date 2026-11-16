import { PartialType } from '@nestjs/swagger';
import { CreateNotationDto } from './create-notation.dto.js';

export class UpdateNotationDto extends PartialType(CreateNotationDto) {}
