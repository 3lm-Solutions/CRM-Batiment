import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDocumentChantierDto {
  @ApiProperty({ example: 'Plan d exécution - niveau 1.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  nom: string;

  @ApiProperty({ example: 'PLAN' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  type: string;

  @ApiProperty({ example: 'https://documents.example.com/plan-niveau-1.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  url: string;
}
