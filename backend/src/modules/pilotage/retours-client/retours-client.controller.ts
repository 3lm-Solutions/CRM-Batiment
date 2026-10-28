import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { QueryRetoursDto, RepondreRetourDto } from './retours-client.dto';
import { RetoursClientService } from './retours-client.service';

/** Who answers the client and marks handled (26/10): the operational roles; the TECHNICO reads. */
const REPONSE = [Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER];

/** Comments and alerts of the client on a job site (Étapes 5–6 of 26/10). */
@ApiTags('Retours client')
@ApiBearerAuth()
@Roles(...STAFF)
@Controller('chantiers/:chantierId/retours')
export class RetoursClientController {
  constructor(private readonly retours: RetoursClientService) {}

  @Get()
  @ApiOperation({ summary: 'Commentaires et alertes du client (alertes ouvertes en premier)' })
  liste(@CurrentUser() user: AuthUser, @Param('chantierId', ParseIntPipe) chantierId: number, @Query() query: QueryRetoursDto) {
    return this.retours.liste(user, chantierId, query);
  }

  @Roles(...REPONSE)
  @Post(':id/repondre') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Répondre au client (affiché dans son espace + email) ; traité par défaut' })
  repondre(@CurrentUser() user: AuthUser, @Param('chantierId', ParseIntPipe) chantierId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: RepondreRetourDto) {
    return this.retours.repondre(user, chantierId, id, dto);
  }

  @Roles(...REPONSE)
  @Post(':id/traiter') @HttpCode(HttpStatus.OK)
  traiter(@CurrentUser() user: AuthUser, @Param('chantierId', ParseIntPipe) chantierId: number, @Param('id', ParseIntPipe) id: number) {
    return this.retours.traiter(user, chantierId, id);
  }

  @Roles(...REPONSE)
  @Post(':id/rouvrir') @HttpCode(HttpStatus.OK)
  rouvrir(@CurrentUser() user: AuthUser, @Param('chantierId', ParseIntPipe) chantierId: number, @Param('id', ParseIntPipe) id: number) {
    return this.retours.rouvrir(user, chantierId, id);
  }
}
