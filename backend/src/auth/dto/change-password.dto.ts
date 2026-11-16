import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Nouveau mot de passe',
    example: 'MonNouveauMdp123!',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le nouveau mot de passe est obligatoire' })
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
  newPassword: string;
}
