import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SaveSignatureDto {
  @ApiProperty({
    description: 'Signature du conseiller au format data URL PNG (base64)',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(100)
  signatureBase64: string;
}
