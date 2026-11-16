import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateDisponibiliteDto {
  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsOptional()
  @IsBoolean()
  disponible?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
