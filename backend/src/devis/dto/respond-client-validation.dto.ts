import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum ClientValidationDecision {
  ACCEPTE = 'ACCEPTE',
  REFUSE = 'REFUSE',
}

export class RespondClientValidationDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Jeton securise envoye au client',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    enum: ClientValidationDecision,
    example: ClientValidationDecision.ACCEPTE,
    description: 'Decision prise par le client',
  })
  @IsEnum(ClientValidationDecision)
  decision: ClientValidationDecision;
}
