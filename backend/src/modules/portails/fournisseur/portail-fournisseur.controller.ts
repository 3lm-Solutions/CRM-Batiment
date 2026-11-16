import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { QueryCommandesPortailDto, ReponseFournisseurDto } from './portail-fournisseur.dto';
import { PortailFournisseurService } from './portail-fournisseur.service';

/** Portal of a FOURNISSEUR account: his own orders only. */
@ApiTags('Portail fournisseur')
@Roles(Role.FOURNISSEUR)
@Controller('portail/fournisseur')
export class PortailFournisseurController {
  constructor(private readonly portail: PortailFournisseurService) {}

  @Get('profil')
  profil(@CurrentUser() user: AuthUser) {
    return this.portail.profil(user);
  }

  @Get('tableau-de-bord')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.portail.dashboard(user);
  }

  @Get('commandes')
  commandes(@CurrentUser() user: AuthUser, @Query() query: QueryCommandesPortailDto) {
    return this.portail.commandes(user, query);
  }

  @Get('commandes/:id')
  commande(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.portail.commande(user, id);
  }

  @Post('commandes/:id/accuser-reception')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmer la prise en compte de la commande (+ date de livraison)' })
  accuserReception(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReponseFournisseurDto,
  ) {
    return this.portail.accuserReception(user, id, dto);
  }

  @Post('commandes/:id/expediee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Signaler l’expédition' })
  expedier(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReponseFournisseurDto,
  ) {
    return this.portail.expedier(user, id, dto);
  }
}
