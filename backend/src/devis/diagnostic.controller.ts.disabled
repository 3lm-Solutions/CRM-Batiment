import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { DiagnosticSessionService } from './diagnostic-session.service.js';
import { DevisAutoGeneratorService } from './devis-auto-generator.service.js';
import {
  CreateSessionDTO,
  AnswerQuestionDTO,
  FillInfoRequiseDTO,
  SelectOptionDTO,
  BulkAnswersDTO,
  BulkFillInfoDTO,
  BulkSelectOptionsDTO,
  GenerateDevisDTO,
} from './dto/diagnostic-session.dto.js';

@ApiTags('Diagnostic & Auto Devis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('diagnostic')
export class DiagnosticController {
  constructor(
    private readonly sessionService: DiagnosticSessionService,
    private readonly devisGenerator: DevisAutoGeneratorService,
  ) {}

  // ═════════════════════════════════════════════════════════════════
  // GESTION SESSIONS DIAGNOSTIQUES
  // ═════════════════════════════════════════════════════════════════

  /**
   * Créer une nouvelle session de diagnostic
   */
  @Post('sessions')
  @Roles('TECHNICO', 'ASSISTANTE', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer une session diagnostique',
    description:
      'Démarre une nouveau processus de diagnostic pour un client. Optionnellement lié à une catégorie/sous-catégorie.',
  })
  @ApiResponse({
    status: 201,
    description: 'Session créée',
    schema: {
      example: {
        id: 1,
        clientId: 5,
        statut: 'EN_COURS',
        createdAt: '2026-03-14T12:00:00Z',
      },
    },
  })
  async createSession(
    @Body() dto: CreateSessionDTO,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sessionService.createSession(
      user.companyId,
      dto.clientId,
      dto.categorieId,
      dto.sousCategorieId,
    );
  }

  /**
   * Récupérer les questions pour une session
   */
  @Get('sessions/:id/questions')
  @ApiOperation({
    summary: 'Récupérer les questions diagnostiques',
    description: 'Retourne la liste des questions à poser au client',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Session ID' })
  async getQuestions(
    @Param('id', ParseIntPipe) sessionId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const session = await this.sessionService.getSessionComplete(sessionId);
    return this.sessionService.getQuestionsForCategory(
      user.companyId,
      session.categorieId || undefined,
      session.sousCategorieId || undefined,
    );
  }

  /**
   * Enregistrer une réponse
   */
  @Post('sessions/:id/reponses')
  @Roles('TECHNICO', 'ASSISTANTE', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Enregistrer une réponse à une question',
    description: 'Ajoute la réponse du client à la question diagnostique',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Session ID' })
  async answerQuestion(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() dto: AnswerQuestionDTO,
  ) {
    return this.sessionService.answerQuestion(sessionId, dto.questionId, dto.contenu);
  }

  /**
   * Enregistrer plusieurs réponses en lot
   */
  @Post('sessions/:id/reponses/bulk')
  @Roles('TECHNICO', 'ASSISTANTE', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Enregistrer plusieurs réponses',
    description: 'Ajoute plusieurs réponses en une seule requête (gain de perf)',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Session ID' })
  async answerQuestionsInBulk(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() dto: BulkAnswersDTO,
  ) {
    return Promise.all(
      dto.reponses.map((rep) => 
        this.sessionService.answerQuestion(sessionId, rep.questionId, rep.contenu)
      ),
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // INFOS REQUISES
  // ═════════════════════════════════════════════════════════════════

  /**
   * Récupérer les infos requises à remplir
   */
  @Get('sessions/:id/infos-requises')
  @ApiOperation({
    summary: 'Récupérer les infos requises',
    description:
      'Retourne la liste des mesures, photos, observations nécessaires',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Session ID' })
  async getInfosRequises(
    @Param('id', ParseIntPipe) sessionId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const session = await this.sessionService.getSessionComplete(sessionId);
    return this.sessionService.getInfosForCategory(
      user.companyId,
      session.categorieId || undefined,
      session.sousCategorieId || undefined,
    );
  }

  /**
   * Remplir une info requise
   */
  @Post('sessions/:id/infos-requises')
  @Roles('TECHNICO', 'ASSISTANTE', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Remplir une info requise',
    description: 'Enregistre la valeur remplie pour une info (mesure, photo URL, etc.)',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Session ID' })
  async fillInfoRequise(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() dto: FillInfoRequiseDTO,
  ) {
    return this.sessionService.fillInfoRequise(
      sessionId,
      dto.infoRequiseId,
      dto.valeur,
      dto.unite,
    );
  }

  /**
   * Remplir plusieurs infos en lot
   */
  @Post('sessions/:id/infos-requises/bulk')
  @Roles('TECHNICO', 'ASSISTANTE', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Remplir plusieurs infos requises',
    description: 'Ajoute plusieurs infos en une seule requête',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Session ID' })
  async fillInfosInBulk(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() dto: BulkFillInfoDTO,
  ) {
    return Promise.all(
      dto.infos.map((info) =>
        this.sessionService.fillInfoRequise(
          sessionId,
          info.infoRequiseId,
          info.valeur,
          info.unite,
        )
      ),
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // OPTIONS & CHOIX
  // ═════════════════════════════════════════════════════════════════

  /**
   * Récupérer les options disponibles
   */
  @Get('sessions/:id/options')
  @ApiOperation({
    summary: 'Récupérer les options disponibles',
    description:
      'Retourne les options et choix disponibles pour les prestations de la catégorie',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Session ID' })
  async getOptions(
    @Param('id', ParseIntPipe) sessionId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const session = await this.sessionService.getSessionComplete(sessionId);
    return this.sessionService.getOptionsForCategory(
      user.companyId,
      session.categorieId || undefined,
      session.sousCategorieId || undefined,
    );
  }

  /**
   * Sélectionner une option
   */
  @Post('sessions/:id/options')
  @Roles('TECHNICO', 'ASSISTANTE', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Sélectionner une option',
    description: 'Enregistre le choix du client pour une option',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Session ID' })
  async selectOption(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() dto: SelectOptionDTO,
  ) {
    return this.sessionService.selectOption(
      sessionId,
      dto.optionPrestationId,
      dto.choixOptionId,
    );
  }

  /**
   * Sélectionner plusieurs options en lot
   */
  @Post('sessions/:id/options/bulk')
  @Roles('TECHNICO', 'ASSISTANTE', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Sélectionner plusieurs options',
    description: 'Enregistre plusieurs sélections en une requête',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Session ID' })
  async selectOptionsInBulk(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() dto: BulkSelectOptionsDTO,
  ) {
    return Promise.all(
      dto.selections.map((sel) =>
        this.sessionService.selectOption(
          sessionId,
          sel.optionPrestationId,
          sel.choixOptionId,
        )
      ),
    );
  }

  /**
   * Obtenir la session complète
   */
  @Get('sessions/:id')
  @ApiOperation({
    summary: 'Récupérer la session complète',
    description:
      'Retourne toutes les données de la session : réponses, infos, options',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Session ID' })
  async getSession(@Param('id', ParseIntPipe) sessionId: number) {
    return this.sessionService.getSessionComplete(sessionId);
  }

  // ═════════════════════════════════════════════════════════════════
  // GÉNÉRATION AUTOMATIQUE DE DEVIS
  // ═════════════════════════════════════════════════════════════════

  /**
   * Générer automatiquement un devis
   */
  @Post('generer-devis')
  @Roles('TECHNICO', 'ASSISTANTE', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '⭐ Générer automatiquement un devis professionnel',
    description: `
    **ÉTAPES AUTOMATIQUES:**
    1. Vérifie la session diagnostique complète
    2. Calcule le prix automatiquement basé sur :
       - Les composants (matériaux + main d'œuvre)
       - Les options choisies et leurs impacts
       - Les infos remplies (quantités, mesures)
    3. Applique la marge commerciale
    4. Génère une référence unique
    5. Crée le devis en BROUILLON
    
    **RÉSULTAT:** Devis professionnel avec tous les totaux calculés automatiquement
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Devis généré avec succès',
    schema: {
      example: {
        devisId: 42,
        reference: 'DEV-2026-0042',
        totalTTC: 2850.5,
        status: 'BROUILLON',
        createdAt: '2026-03-14T12:00:00Z',
      },
    },
  })
  async generateDevis(
    @Body() dto: GenerateDevisDTO,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const session = await this.sessionService.getSessionComplete(dto.sessionDiagId);
    
    return this.devisGenerator.generateDevisFromSession({
      sessionDiagId: dto.sessionDiagId,
      clientId: session.clientId,
      companyId: user.companyId,
      notes: dto.notes,
    });
  }

  /**
   * Récupérer un devis généré avec toutes les infos
   */
  @Get('devis/:devisId')
  @ApiOperation({
    summary: 'Récupérer un devis complet',
    description:
      'Retourne le devis avec toutes les infos : lignes, client, options choisies, etc.',
  })
  @ApiParam({ name: 'devisId', type: Number, description: 'Devis ID' })
  async getDevisComplet(
    @Param('devisId', ParseIntPipe) devisId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const devis = await this.devisGenerator.getDevisComplet(devisId);
    
    // Vérifier l'accès
    if (devis.companyId !== user.companyId) {
      throw new Error('Accès refusé');
    }

    return devis;
  }
}
