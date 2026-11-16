import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifySignatureOtpDto {
  @ApiProperty({
    description: 'Code OTP recu par SMS',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  otpCode: string;
}
