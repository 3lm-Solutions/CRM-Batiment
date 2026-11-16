import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ResetTemporaryPasswordDto } from './dto/reset-temporary-password.dto.js';
import { SaveSignatureDto } from './dto/save-signature.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { Role } from '../../generated/prisma/client.js';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ──────────────────────────────────────────────
  // POST /auth/login — Étapes 2 & 4
  // ──────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Connexion utilisateur',
    description:
      'Vérifie email + mot de passe. Si mustChangePassword=true, retourne un token temporaire pour changer le mot de passe.',
  })
  @ApiResponse({
    status: 200,
    description: 'Connexion réussie ou changement de mot de passe requis',
  })
  @ApiResponse({ status: 401, description: 'Email ou mot de passe incorrect' })
  @ApiResponse({ status: 403, description: 'Compte désactivé' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Vérifier si un email existe pour réinitialisation',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-reset-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verifier le code de reinitialisation' })
  async verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réinitialiser le mot de passe' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ──────────────────────────────────────────────
  // POST /auth/change-password — Étape 3
  // ──────────────────────────────────────────────

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Changement de mot de passe',
    description:
      'Permet de changer le mot de passe (obligatoire au premier login). Requiert un token JWT valide (ou le tempToken reçu au login).',
  })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe changé avec succès + nouveau JWT',
  })
  @ApiResponse({ status: 401, description: 'Token invalide ou expiré' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.authService.changePassword(dto, user);
  }

  // ──────────────────────────────────────────────
  // POST /auth/create-user — Étape 1 (Admin uniquement)
  // ──────────────────────────────────────────────

  @Post('create-user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Créer un utilisateur (Admin uniquement)',
    description:
      "L'admin saisit email + rôle + nom/prénom. Le backend génère un mot de passe temporaire, crée le compte et envoie un email.",
  })
  @ApiResponse({ status: 201, description: 'Utilisateur créé avec succès' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux admins' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    return this.authService.createUser(dto, admin);
  }

  @Post('reset-temp-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reinitialiser le mot de passe temporaire (Admin uniquement)',
    description:
      "Genere un nouveau mot de passe temporaire pour l'utilisateur cible et l'envoie par email (ou l'affiche en console en mode dev).",
  })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe temporaire reinitialise avec succes',
  })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouve' })
  async resetTemporaryPassword(
    @Body() dto: ResetTemporaryPasswordDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    return this.authService.resetTemporaryPassword(dto, admin);
  }

  // ──────────────────────────────────────────────
  // GET /auth/profile — Étape 5
  // ──────────────────────────────────────────────

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Profil utilisateur connecté',
    description:
      "Retourne les informations du profil de l'utilisateur authentifié.",
  })
  @ApiResponse({ status: 200, description: 'Profil retourné' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getProfile(user);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modifier mon profil' })
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.authService.updateProfile(dto, user);
  }

  @Get('signature')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Recuperer la signature du conseiller connecte',
  })
  async getSignature(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getSignature(user);
  }

  @Post('signature')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sauvegarder ou remplacer la signature du conseiller connecte',
  })
  async saveSignature(
    @Body() dto: SaveSignatureDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.authService.saveSignature(dto, user);
  }
}
