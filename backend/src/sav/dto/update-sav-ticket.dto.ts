import { PartialType } from '@nestjs/swagger';
import { CreateSavTicketDto } from './create-sav-ticket.dto.js';

export class UpdateSavTicketDto extends PartialType(CreateSavTicketDto) {}
