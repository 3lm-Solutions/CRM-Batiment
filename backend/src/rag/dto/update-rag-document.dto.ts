import { PartialType } from '@nestjs/swagger';
import { CreateRagDocumentDto } from './create-rag-document.dto.js';

export class UpdateRagDocumentDto extends PartialType(CreateRagDocumentDto) {}
