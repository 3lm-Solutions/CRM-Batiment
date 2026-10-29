import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Role } from '../../../../generated/prisma/client';

export class DemoConnexionDto {
  @ApiProperty({ enum: Role, example: Role.ADMIN })
  @IsEnum(Role, { message: 'Rôle inconnu' })
  role: Role;
}
