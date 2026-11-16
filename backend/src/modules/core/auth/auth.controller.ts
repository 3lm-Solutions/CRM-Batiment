import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ALL_ROLES,
  AllowPasswordChangeToken,
  type AuthUser,
  CurrentUser,
  Public,
  Roles,
  STAFF,
} from '../../../common';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  RefreshDto,
  ResetPasswordDto,
  SaveSignatureDto,
  UpdateProfileDto,
  VerifyResetCodeDto,
} from './dto/auth.dto';

/** Brute-force protection on public endpoints (per IP). */
const STRICT = { default: { limit: 5, ttl: 60_000 } };
const VERY_STRICT = { default: { limit: 3, ttl: 60_000 } };
/** A phone refreshes about once a day; a few retries allowed. */
const REFRESH = { default: { limit: 10, ttl: 60_000 } };

/** 16/11: the mobile app sends « X-Client: mobile » (and optionally « X-Appareil: <name> »). */
const estMobile = (client?: string) => client?.trim().toLowerCase() === 'mobile';

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
  login(
    @Body() dto: LoginDto,
    @Headers('x-client') client?: string,
    @Headers('x-appareil') appareil?: string,
  ) {
    return this.auth.login(dto, estMobile(client), appareil);
  }

  @Public()
  @Throttle(REFRESH)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mobile : nouveau token avec le jeton de rafraîchissement (qui est remplacé)',
  })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Throttle(REFRESH)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Mobile : déconnexion (jeton de rafraîchissement révoqué, plus de push sur ce téléphone)',
  })
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.refreshToken, dto.jetonPush);
  }

  @ApiBearerAuth()
  @AllowPasswordChangeToken()
  @Roles(...ALL_ROLES)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Changer son mot de passe',
    description:
      'Exige le mot de passe actuel. Ferme toutes les autres sessions et renvoie un nouveau token.',
  })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Headers('x-client') client?: string,
    @Headers('x-appareil') appareil?: string,
  ) {
    return this.auth.changePassword(user, dto, estMobile(client), appareil);
  }

  @Public()
  @Throttle(VERY_STRICT)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Demander un code de réinitialisation (réponse identique si l’email est inconnu)',
  })
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
