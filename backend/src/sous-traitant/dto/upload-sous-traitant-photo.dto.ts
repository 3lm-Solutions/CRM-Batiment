import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UploadSousTraitantPhotoDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chantierId!: number;

  @ApiPropertyOptional({ example: 'Pose du carrelage terminée' })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  titre?: string;
}
