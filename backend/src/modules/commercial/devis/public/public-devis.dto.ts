import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsSignaturePng, Trim } from '../../../../common';

export class RefuserDevisDto {
  @ApiPropertyOptional({ example: 'Budget trop élevé' })
  @IsOptional() @Trim() @IsString() @MaxLength(1000)
  motif?: string;
}

export class VerifierCodeDto {
  @ApiProperty({ example: '482913' })
  @Trim() @Matches(/^\d{6}$/, { message: 'Le code doit contenir 6 chiffres' })
  code: string;
}

export class SignerClientDto {
  @IsSignaturePng()
  signatureBase64: string;
}
