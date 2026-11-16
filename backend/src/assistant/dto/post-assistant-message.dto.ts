import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class PostAssistantMessageDto {
  @ApiProperty({ example: 1, description: 'ID de la societe ciblee' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId: number;

  @ApiProperty({
    example: 'Je m appelle Amine, mon telephone 0612345678',
    description: 'Message texte du prospect',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}
