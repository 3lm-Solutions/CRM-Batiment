import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ALL_ROLES, AllowPasswordChangeToken, type AuthUser, CurrentUser, Public, Roles, STAFF } from '../../../common';
import { AuthService } from './auth.service';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, ResetPasswordDto, SaveSignatureDto, UpdateProfileDto, VerifyResetCodeDto } from './dto/auth.dto';

/** Brute-force protection on public endpoints (per IP). */
const STRICT = { default: { limit: 5, ttl: 60_000 } };
const VERY_STRICT = { default: { limit: 3, ttl: 60_000 } };

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(STRICT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Connexion',
    description:
      'Retourne un accessToken, ou — au premier login — un passwordChangeToken valable 15 min ' +
      'utilisable UNIQUEMENT sur POST /auth/change-password.',
  })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @ApiBearerAuth()
  @AllowPasswordChangeToken()
  @Roles(...ALL_ROLES)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Changer son mot de passe',
    description: 'Exige le mot de passe actuel. Ferme toutes les autres sessions et renvoie un nouveau token.',
  })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user, dto);
  }

  @Public()
  @Throttle(VERY_STRICT)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Demander un code de réinitialisation (réponse identique si l’email est inconnu)' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Throttle(STRICT)
  @Post('verify-reset-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vérifier un code (5 essais max, puis le code est détruit)' })
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.auth.verifyResetCode(dto);
  }

  @Public()
  @Throttle(STRICT)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Choisir un nouveau mot de passe avec le code reçu' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @ApiBearerAuth()
  @Roles(...ALL_ROLES)
  @Get('me')
  @ApiOperation({ summary: 'Mon profil' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @ApiBearerAuth()
  @Roles(...ALL_ROLES)
  @Patch('me')
  @ApiOperation({ summary: 'Modifier mon profil (changer d’email exige le mot de passe)' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateMe(user, dto);
  }

  @ApiBearerAuth()
  @Roles(...STAFF)
  @Get('me/signature')
  @ApiOperation({ summary: 'Ma signature (conseiller)' })
  getSignature(@CurrentUser() user: AuthUser) {
    return this.auth.getSignature(user);
  }

  @ApiBearerAuth()
  @Roles(...STAFF)
  @Put('me/signature')
  @ApiOperation({ summary: 'Enregistrer / remplacer ma signature' })
  saveSignature(@CurrentUser() user: AuthUser, @Body() dto: SaveSignatureDto) {
    return this.auth.saveSignature(user, dto);
  }

  @ApiBearerAuth()
  @Roles(...STAFF)
  @Delete('me/signature')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer ma signature' })
  deleteSignature(@CurrentUser() user: AuthUser) {
    return this.auth.deleteSignature(user);
  }
}
