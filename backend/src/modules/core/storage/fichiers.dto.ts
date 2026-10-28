import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/** Multipart fields arrive as strings: @Type converts them. */
export class UploadFichierDto {
  @ApiPropertyOptional({ description: 'Chantier : le fichier devient lisible par les intervenants de ce chantier' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  chantierId?: number;
}
