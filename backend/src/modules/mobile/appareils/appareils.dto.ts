import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Trim } from '../../../common';

/** Expo push token: « ExponentPushToken[xxxx] » (or the newer « ExpoPushToken[xxxx] »). */
export const JETON_EXPO = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/;

export class EnregistrerAppareilDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @Trim()
  @IsString()
  @MaxLength(250)
  @Matches(JETON_EXPO, { message: 'Jeton push Expo invalide' })
  jeton: string;

  @ApiPropertyOptional({ enum: ['ios', 'android', 'web'] })
  @IsOptional()
  @IsIn(['ios', 'android', 'web'])
  plateforme?: string;

  @ApiPropertyOptional({ example: 'iPhone de Paul' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  nom?: string;
}
