import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, BUREAU, CurrentUser, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { DevisLifecycleService } from './devis-lifecycle.service';
import { DevisService } from './devis.service';
import { AnnulerDevisDto, CreateDevisDto, QueryDevisDto, ReviserDevisDto, SignerConseillerDto, UpdateDevisDto } from './dto/devis.dto';

/**
 * Quotes. Status changes are ACTIONS (POST /devis/:id/envoyer…), never a PATCH of `statut`:
 * that is what makes the state machine impossible to bypass.
 */
@ApiTags('Devis')
@ApiBearerAuth()
@Roles(...BUREAU)
@Controller('devis')
export class DevisController {
  constructor(
    private readonly devis: DevisService,
    private readonly lifecycle: DevisLifecycleService,
  ) {}

  @Roles(...STAFF)
  @Get()
  @ApiOperation({ summary: 'Liste (chef de chantier : devis de ses chantiers, sans montants)' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryDevisDto) {
    return this.devis.findAll(user, query);
  }

  @Roles(...STAFF)
  @Get(':id')
  @ApiOperation({ summary: 'Détail (coûts et marge pour le bureau ; vue chantier pour le chef)' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.devis.findOne(user, id);
  }

  @Get(':id/versions')
  versions(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.devis.versions(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDevisDto) {
    return this.devis.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier TVA / notes (brouillon ou révision uniquement)' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDevisDto) {
    return this.devis.update(user, id, dto);
  }

  @Post(':id/dupliquer')
  dupliquer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.devis.duplicate(user, id);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un brouillon jamais envoyé (sinon : annuler)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.devis.remove(user, id);
  }

  // ── actions ─────────────────────────────────────────────────────────────

  @Post(':id/envoyer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envoyer au client (lien de validation par email)' })
  envoyer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.lifecycle.envoyer(user, id);
  }

  @Post(':id/renvoyer-lien')
  @HttpCode(HttpStatus.OK)
  renvoyerLien(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.lifecycle.renvoyerLien(user, id);
  }

  @Post(':id/reviser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nouvelle version (les liens déjà envoyés sont annulés)' })
  reviser(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReviserDevisDto) {
    return this.lifecycle.reviser(user, id, dto);
  }

  @Post(':id/annuler')
  @HttpCode(HttpStatus.OK)
  annuler(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AnnulerDevisDto) {
    return this.lifecycle.annuler(user, id, dto);
  }

  @Post(':id/demander-signature')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envoyer le lien de signature (code à usage unique par email)' })
  demanderSignature(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.lifecycle.demanderSignature(user, id);
  }

  @Post(':id/signer-conseiller')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Signature du conseiller (verbal: true pour un accord oral du client)' })
  signerConseiller(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: SignerConseillerDto) {
    return this.lifecycle.signerConseiller(user, id, dto);
  }
}
