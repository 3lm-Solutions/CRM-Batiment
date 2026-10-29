import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginResponse, SessionResponse, SessionUser } from '../../../shared';
import {
  type AuthUser,
  BusinessException,
  buildJwtPayload,
  type TokenSubject,
} from '../../../common';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { passwordResetCodeMail } from '../mail/templates/auth.templates';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SaveSignatureDto,
  UpdateProfileDto,
  VerifyResetCodeDto,
} from './dto/auth.dto';
import { PasswordService } from './password.service';

const INVALID_CREDENTIALS = 'Email ou mot de passe incorrect';
const RESET_CODE_VALIDITY_MINUTES = 10;
const RESET_CODE_MAX_ATTEMPTS = 5;
const PASSWORD_CHANGE_TOKEN_TTL = '15m';

const PROFILE_SELECT = {
  id: true,
  email: true,
  nom: true,
  prenom: true,
  role: true,
  telephone: true,
  companyId: true,
  company: { select: { id: true, nom: true } },
  signatureUpdatedAt: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type SessionSource = TokenSubject & { nom: string; prenom: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
  ) {}

  // ── Login ───────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Password checked FIRST (with a dummy hash if the email is unknown): the response
    // never reveals whether an account exists or is deactivated to someone without the password
    const passwordOk = await this.passwords.verify(dto.password, user?.password);
    if (!user || !passwordOk) throw new UnauthorizedException(INVALID_CREDENTIALS);

    if (!user.actif) {
      throw new ForbiddenException("Votre compte a été désactivé. Contactez l'administrateur.");
    }

    if (user.mustChangePassword) {
      // Restricted token: accepted ONLY by POST /auth/change-password
      return {
        mustChangePassword: true,
        passwordChangeToken: this.jwt.sign(buildJwtPayload(user, 'password-change'), {
          expiresIn: PASSWORD_CHANGE_TOKEN_TTL,
        }),
        message: 'Vous devez choisir un nouveau mot de passe avant de continuer.',
      };
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.createSession(user);
  }

  // ── Change password (first login or voluntary) ──────────────────────────

  async changePassword(
    authUser: AuthUser,
    dto: ChangePasswordDto,
  ): Promise<SessionResponse & { message: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: authUser.id } });

    // 422, not 401: a 401 would make the frontend log the user out
    if (!(await this.passwords.verify(dto.currentPassword, user.password))) {
      throw new BusinessException(
        'MOT_DE_PASSE_ACTUEL_INCORRECT',
        'Le mot de passe actuel est incorrect.',
      );
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BusinessException(
        'MOT_DE_PASSE_IDENTIQUE',
        "Le nouveau mot de passe doit être différent de l'actuel.",
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: await this.passwords.hash(dto.newPassword),
        mustChangePassword: false,
        tokenVersion: { increment: 1 }, // logs out every other session
        lastLoginAt: new Date(),
      },
    });

    this.logger.log(`Mot de passe changé : utilisateur #${user.id}`);
    return { message: 'Mot de passe modifié.', ...this.createSession(updated) };
  }

  // ── Forgot password: email → 6-digit code → new password ────────────────

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (user?.actif) {
      const code = this.passwords.generateResetCode();
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetCodeHash: this.passwords.hashResetCode(code),
          resetCodeExpiresAt: new Date(Date.now() + RESET_CODE_VALIDITY_MINUTES * 60_000),
          resetCodeAttempts: 0,
        },
      });
      // Not awaited: the response time must not depend on whether the account exists
      void this.mail.send(
        user.email,
        passwordResetCodeMail({ code, validityMinutes: RESET_CODE_VALIDITY_MINUTES }),
      );
    }

    // Same answer whether the email exists or not (the old 404 let anyone list accounts)
    return { message: 'Si un compte existe pour cet email, un code de vérification a été envoyé.' };
  }

  async verifyResetCode(dto: VerifyResetCodeDto): Promise<{ valid: true }> {
    await this.checkResetCode(dto.email, dto.code);
    return { valid: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.checkResetCode(dto.email, dto.code);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: await this.passwords.hash(dto.newPassword),
        mustChangePassword: false,
        resetCodeHash: null,
        resetCodeExpiresAt: null,
        resetCodeAttempts: 0,
        tokenVersion: { increment: 1 },
      },
    });

    this.logger.log(`Mot de passe réinitialisé par code : utilisateur #${user.id}`);
    return { message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' };
  }

  private async checkResetCode(email: string, code: string) {
    const invalid = () =>
      new BusinessException(
        'CODE_INVALIDE',
        'Code de vérification invalide ou expiré.',
        HttpStatus.BAD_REQUEST,
      );

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user?.actif ||
      !user.resetCodeHash ||
      !user.resetCodeExpiresAt ||
      user.resetCodeExpiresAt < new Date()
    ) {
      throw invalid();
    }

    if (!this.passwords.resetCodeMatches(code, user.resetCodeHash)) {
      const attempts = user.resetCodeAttempts + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data:
          attempts >= RESET_CODE_MAX_ATTEMPTS
            ? { resetCodeHash: null, resetCodeExpiresAt: null, resetCodeAttempts: 0 } // burned
            : { resetCodeAttempts: attempts },
      });
      throw invalid();
    }

    return user;
  }

  // ── Own profile & signature ─────────────────────────────────────────────

  me(authUser: AuthUser) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: authUser.id },
      select: PROFILE_SELECT,
    });
  }

  async updateMe(authUser: AuthUser, dto: UpdateProfileDto) {
    const { currentPassword, ...data } = dto;

    if (data.email && data.email !== authUser.email) {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: authUser.id } });
      if (!(await this.passwords.verify(currentPassword ?? '', user.password))) {
        throw new BusinessException(
          'MOT_DE_PASSE_ACTUEL_INCORRECT',
          'Le mot de passe actuel est incorrect.',
        );
      }
    }

    // Email already taken -> Prisma P2002 -> 409 DUPLICATE (global filter)
    return this.prisma.user.update({ where: { id: authUser.id }, data, select: PROFILE_SELECT });
  }

  getSignature(authUser: AuthUser) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: authUser.id },
      select: { signatureBase64: true, signatureUpdatedAt: true },
    });
  }

  saveSignature(authUser: AuthUser, dto: SaveSignatureDto) {
    return this.prisma.user.update({
      where: { id: authUser.id },
      data: { signatureBase64: dto.signatureBase64, signatureUpdatedAt: new Date() },
      select: { signatureUpdatedAt: true },
    });
  }

  async deleteSignature(authUser: AuthUser): Promise<void> {
    await this.prisma.user.update({
      where: { id: authUser.id },
      data: { signatureBase64: null, signatureUpdatedAt: null },
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Also used by the demo sandbox (Step 15) to open a session without a password. */
  createSession(user: SessionSource): SessionResponse {
    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      role: user.role,
      companyId: user.companyId,
    };
    return { accessToken: this.jwt.sign(buildJwtPayload(user)), user: sessionUser };
  }
}
