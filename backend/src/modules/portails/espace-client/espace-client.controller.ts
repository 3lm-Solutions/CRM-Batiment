import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type AuthUser, BUREAU, CurrentUser, Public, Roles } from '../../../common';
import { CreateSavClientDto, NoteSavClientDto } from './espace-client.dto';
import { EspaceClientService } from './espace-client.service';

const READ = { default: { limit: 60, ttl: 60_000 } };
const WRITE = { default: { limit: 5, ttl: 60_000 } };

/** Office: send / list / revoke the link of a client's online space. */
@ApiTags('Espace client')
@Roles(...BUREAU)
@Controller('clients/:clientId/espace')
export class EspaceClientAdminController {
  constructor(private readonly espace: EspaceClientService) {}

  @Post('lien')
  @ApiOperation({ summary: 'Envoyer au client le lien de son espace (les liens précédents sont désactivés)' })
  envoyer(@CurrentUser() user: AuthUser, @Param('clientId', ParseIntPipe) clientId: number) {
    return this.espace.envoyerLien(user, clientId);
  }

  @Get('liens')
  liens(@CurrentUser() user: AuthUser, @Param('clientId', ParseIntPipe) clientId: number) {
    return this.espace.liens(user, clientId);
  }

  @Delete('liens') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Désactiver tous les liens de ce client' })
  revoquer(@CurrentUser() user: AuthUser, @Param('clientId', ParseIntPipe) clientId: number) {
    return this.espace.revoquer(user, clientId);
  }
}

/** The client's page, opened from the email. No authentication: the token is the credential. */
@ApiTags('Espace client (public)')
@Public()
@Controller('public/espace-client/:token')
export class EspaceClientPublicController {
  constructor(private readonly espace: EspaceClientService) {}

  @Throttle(READ)
  @Get()
  view(@Param('token') token: string) {
    return this.espace.view(token);
  }

  @Throttle(READ)
  @Get('devis/:id')
  devis(@Param('token') token: string, @Param('id', ParseIntPipe) id: number) {
    return this.espace.devis(token, id);
  }

  @Throttle(READ)
  @Get('factures/:id')
  facture(@Param('token') token: string, @Param('id', ParseIntPipe) id: number) {
    return this.espace.facture(token, id);
  }

  @Throttle(WRITE)
  @Post('sav')
  @ApiOperation({ summary: 'Signaler un problème (ouvre un ticket SAV)' })
  ouvrirSav(@Param('token') token: string, @Body() dto: CreateSavClientDto) {
    return this.espace.ouvrirSav(token, dto);
  }

  @Throttle(WRITE)
  @Post('sav/:id/messages')
  repondre(@Param('token') token: string, @Param('id', ParseIntPipe) id: number, @Body() dto: NoteSavClientDto) {
    return this.espace.repondreSav(token, id, dto.contenu);
  }
}
