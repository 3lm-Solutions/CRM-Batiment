import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResetTemporaryPasswordDto {
  @ApiProperty({
    example: 'rim@batiment-pro.fr',
    description: 'Email du compte a reinitialiser',
  })
  @IsEmail({}, { message: "L'email doit etre valide" })
  @IsNotEmpty({ message: "L'email est obligatoire" })
  email: string;
}
