import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

/** A handwritten signature captured in the browser: PNG data URL, 500 KB max. */
export function IsSignaturePng() {
  return applyDecorators(
    ApiProperty({ description: 'Signature PNG en base64 (data:image/png;base64,…), 500 Ko max' }),
    IsString(),
    MaxLength(700_000, { message: 'Signature trop volumineuse (500 Ko max)' }),
    Matches(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/, {
      message: 'La signature doit être une image PNG en base64 (data:image/png;base64,…)',
    }),
  );
}
