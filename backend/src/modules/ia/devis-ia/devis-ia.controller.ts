import { Body, Controller, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type AuthUser, BUREAU, CurrentUser, Roles } from '../../../common';
import { DevisIaService } from './devis-ia.service';
import { AppliquerDevisIaDto, ProposerDevisIaDto } from './dto/devis-ia.dto';

@ApiTags('Devis — assistant IA')
@ApiBearerAuth()
@Roles(...BUREAU)
@Controller('devis/:devisId/ia')
export class DevisIaController {
  constructor(private readonly service: DevisIaService) {}

  /** Each call may cost an OpenAI request: 20 per minute per client is plenty for a human. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('proposer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Proposer des lignes du catalogue à partir d’une description (rien n’est enregistré)' })
  proposer(@CurrentUser() user: AuthUser, @Param('devisId', ParseIntPipe) devisId: number, @Body() dto: ProposerDevisIaDto) {
    return this.service.proposer(user, devisId, dto);
  }

  @Post('appliquer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ajouter au devis les lignes retenues (une seule transaction)' })
  appliquer(@CurrentUser() user: AuthUser, @Param('devisId', ParseIntPipe) devisId: number, @Body() dto: AppliquerDevisIaDto) {
    return this.service.appliquer(user, devisId, dto);
  }
}
