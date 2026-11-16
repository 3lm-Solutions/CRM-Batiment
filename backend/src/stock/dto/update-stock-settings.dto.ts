import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class UpdateStockSettingsDto {
  @ApiProperty({ example: 10, description: 'Seuil minimum déclenchant une alerte' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockMinimum: number;
}
