import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, BUREAU, CurrentUser, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import type { UploadedBinary } from '../../core/storage/upload.config';
import { DevisLifecycleService } from './devis-lifecycle.service';
import { DevisPdfService } from './devis-pdf.service';
import { DevisService } from './devis.service';
import {
  AnnulerDevisDto,
  BrouillonChefDto,
  CreateDevisDto,
  QueryDevisDto,
  RefuserDevisInterneDto,
  RejeterSignaturePapierDto,
  ReviserDevisDto,
  SignerConseillerDto,
  SignaturePapierDto,
  SignerSurPlaceDto,
  UpdateDevisDto,
  VerifierQrDto,
} from './dto/devis.dto';

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
    private readonly pdf: DevisPdfService,
  ) {}

  @Roles(...STAFF)
  @Get()
  @ApiOperation({ summary: 'Liste (chef de chantier : devis de ses chantiers, sans montants)' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryDevisDto) {
    return this.devis.findAll(user, query);
  }

  /** Declared before `:id` (otherwise « verifier-qr » would be parsed as an id). */
  @Get('verifier-qr')
  @ApiOperation({
    summary: 'Vérifier le QR code imprimé sur un devis (authentique, version à jour)',
  })
  verifierQr(@CurrentUser() user: AuthUser, @Query() query: VerifierQrDto) {
    return this.lifecycle.verifierQr(user, query.contenu);
  }

  @Roles(...STAFF)
  @Get(':id')
  @ApiOperation({ summary: 'Détail (coûts et marge pour le bureau ; vue chantier pour le chef)' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.devis.findOne(user, id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'PDF du devis (prix de vente uniquement, QR de vérification)' })
  telechargerPdf(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    return this.pdf.telecharger(user, id);
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
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDevisDto,
  ) {
    return this.devis.update(user, id, dto);
  }

  @Post(':id/dupliquer')
  dupliquer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.devis.duplicate(user, id);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Supprimer un brouillon jamais envoyé, ou un devis annulé sans facture / commande / chantier',
  })
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
  reviser(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviserDevisDto,
  ) {
    return this.lifecycle.reviser(user, id, dto);
  }

  @Post(':id/annuler')
  @HttpCode(HttpStatus.OK)
  annuler(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnnulerDevisDto,
  ) {
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
  signerConseiller(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SignerConseillerDto,
  ) {
    return this.lifecycle.signerConseiller(user, id, dto);
  }

  // ── 05/11 (re-applied 16/11) + mobile lot B1 ────────────────────────────

  @Roles(Role.CHEF_CHANTIER)
  @Post('brouillon-chef')
  @ApiOperation({
    summary:
      'Chef de chantier : commencer un brouillon pour le Devis IA (client de ses chantiers ou prospect envoyé), sans prix',
  })
  brouillonChef(@CurrentUser() user: AuthUser, @Body() dto: BrouillonChefDto) {
    return this.devis.createBrouillonChef(user, dto);
  }

  @Post(':id/remettre')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remis en main propre : ENVOYE / RENVOYE sans email' })
  remettre(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.lifecycle.remettre(user, id);
  }

  @Post(':id/lien-whatsapp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lien de validation à partager par WhatsApp (lien wa.me, rien n’est envoyé)',
  })
  lienWhatsapp(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.lifecycle.lienWhatsapp(user, id);
  }

  @Post(':id/signature-papier')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('fichier'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fichier'],
      properties: {
        fichier: { type: 'string', format: 'binary' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
      },
    },
  })
  @ApiOperation({ summary: 'Déposer le scan / la photo du devis signé sur papier → SIGNE_PAPIER' })
  deposerSignaturePapier(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() fichier: UploadedBinary | undefined,
    @Body() dto: SignaturePapierDto,
  ) {
    return this.lifecycle.deposerSignaturePapier(user, id, fichier, dto);
  }

  @Roles(Role.ADMIN)
  @Post(':id/signature-papier/valider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ADMIN : signature papier conforme → SIGNE' })
  validerSignaturePapier(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.lifecycle.validerSignaturePapier(user, id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/signature-papier/rejeter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ADMIN : signature papier refusée → statut précédent, avec le motif' })
  rejeterSignaturePapier(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejeterSignaturePapierDto,
  ) {
    return this.lifecycle.rejeterSignaturePapier(user, id, dto);
  }

  @Post(':id/refuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refus du client constaté par l’équipe (motif obligatoire)' })
  refuser(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RefuserDevisInterneDto,
  ) {
    return this.lifecycle.refuser(user, id, dto);
  }

  @Post(':id/signer-sur-place')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Signature du client sur le téléphone du conseiller → SIGNE (mobile)' })
  signerSurPlace(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SignerSurPlaceDto,
  ) {
    return this.lifecycle.signerSurPlace(user, id, dto);
  }
}
