import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SubmitClientSignatureDto {
  @ApiProperty({
    description: 'JWT temporaire retourne apres verification OTP',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  sessionToken: string;

  @ApiProperty({
    description: 'Signature du client au format data URL PNG (base64)',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(100)
  signatureBase64: string;
}
