import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../../common';

export class CreateChecklistItemDto {
  @ApiProperty({ example: 'Poser le primaire d’accrochage' }) @Trim() @IsString() @IsNotEmpty() @MaxLength(200)
  libelle: string;
}

export class UpdateChecklistItemDto {
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(200)
  libelle?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  fait?: boolean;
}

/** From the sous-traitant portal: he only ticks / unticks. */
export class CocherChecklistItemDto {
  @ApiProperty() @IsBoolean()
  fait: boolean;
}
