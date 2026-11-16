import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ResetTemporaryPasswordDto } from './dto/reset-temporary-password.dto.js';
import { SaveSignatureDto } from './dto/save-signature.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto.js';
import {
  JwtPayload,
  CurrentUserPayload,
} from '../common/interfaces/jwt-payload.interface.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private configService: ConfigService,
  ) {}

  private ensureSignatureBase64(signatureBase64: string) {
    if (!signatureBase64.startsWith('data:image/png;base64,')) {
      throw new ForbiddenException(
        'La signature doit etre une image PNG base64 valide.',
      );
    }
  }

  // ──────────────────────────────────────────────
  // Étape 1 : Création du compte par Admin
  // ──────────────────────────────────────────────

  async createUser(dto: CreateUserDto, admin: CurrentUserPayload) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Vérifier que l'email n'existe pas déjà
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    // Générer un mot de passe temporaire (12 caractères)
    const tempPassword = randomBytes(6).toString('hex'); // ex: "a3f4b2c1d9e5"

    // Hash le mot de passe temporaire
    const hashedPassword = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    // Créer le compte dans la base
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        nom: dto.nom,
        prenom: dto.prenom,
        role: dto.role,
        telephone: dto.telephone,
        password: hashedPassword,
        mustChangePassword: true,
        actif: true,
        companyId: admin.companyId,
      },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        telephone: true,
        actif: true,
        mustChangePassword: true,
        companyId: true,
        createdAt: true,
      },
    });

    // Envoyer l'email avec le mot de passe temporaire
    await this.mailService.sendTemporaryPassword(
      dto.email,
      dto.nom,
      dto.prenom,
      tempPassword,
    );

    const appEnv = (
      this.configService.get<string>('APP_ENV') || 'development'
    ).toLowerCase();
    const exposeTempPassword = appEnv !== 'production';

    this.logger.log(
      `Utilisateur créé : ${user.email} (${user.role}) par admin #${admin.userId}`,
    );

    return {
      message:
        'Utilisateur créé avec succès. Un email a été envoyé avec le mot de passe temporaire.',
      user,
      temporaryPassword: exposeTempPassword ? tempPassword : undefined,
    };
  }

  async resetTemporaryPassword(
    dto: ResetTemporaryPasswordDto,
    admin: CurrentUserPayload,
  ) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        companyId: admin.companyId,
      },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Utilisateur introuvable pour cette entreprise',
      );
    }

    const tempPassword = randomBytes(6).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: true,
        actif: true,
      },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        mustChangePassword: true,
        actif: true,
      },
    });

    await this.mailService.sendTemporaryPassword(
      updatedUser.email,
      updatedUser.nom,
      updatedUser.prenom,
      tempPassword,
    );

    const appEnv = (
      this.configService.get<string>('APP_ENV') || 'development'
    ).toLowerCase();
    const exposeTempPassword = appEnv !== 'production';

    this.logger.log(
      `Mot de passe temporaire reinitialise pour ${updatedUser.email} par admin #${admin.userId}`,
    );

    return {
      message:
        'Nouveau mot de passe temporaire genere et envoye (email/console selon configuration).',
      user: updatedUser,
      temporaryPassword: exposeTempPassword ? tempPassword : undefined,
    };
  }

  // ──────────────────────────────────────────────
  // Étape 2 & 4 : Login (premier login ou normal)
  // ──────────────────────────────────────────────

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Rechercher l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Vérifier que le compte est actif
    if (!user.actif) {
      throw new ForbiddenException(
        "Votre compte a été désactivé. Contactez l'administrateur.",
      );
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Si mustChangePassword = true → premier login
    if (user.mustChangePassword) {
      // Générer un token temporaire limité au changement de mot de passe
      const tempPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      };
      const tempToken = this.jwtService.sign(tempPayload, { expiresIn: '15m' });

      return {
        mustChangePassword: true,
        message: 'Vous devez changer votre mot de passe avant de continuer.',
        tempToken, // Token temporaire pour le changement de mot de passe
      };
    }

    // Login normal → Étape 4 : génération JWT
    return this.generateLoginResponse(user);
  }

  // ──────────────────────────────────────────────
  // Étape 3 : Changement obligatoire du mot de passe
  // ──────────────────────────────────────────────

  async changePassword(
    dto: ChangePasswordDto,
    currentUser: CurrentUserPayload,
  ) {
    // Hash le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    // Mettre à jour en base
    const user = await this.prisma.user.update({
      where: { id: currentUser.userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    });

    this.logger.log(
      `Mot de passe changé pour l'utilisateur #${user.id} (${user.email})`,
    );

    // Générer un vrai JWT après changement du mot de passe
    return {
      message: 'Mot de passe changé avec succès.',
      ...this.generateLoginResponse(user),
    };
  }

  // ──────────────────────────────────────────────
  // Étape 5 : Informations du profil connecté
  // ──────────────────────────────────────────────

  async getProfile(currentUser: CurrentUserPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        telephone: true,
        actif: true,
        companyId: true,
        company: {
          select: {
            id: true,
            nom: true,
          },
        },
        signatureBase64: true,
        signatureUpdatedAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    return user;
  }

  async updateProfile(dto: UpdateProfileDto, currentUser: CurrentUserPayload) {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findFirst({
      where: { email, id: { not: currentUser.userId } },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Cette adresse email est deja utilisee.');
    }

    return this.prisma.user.update({
      where: { id: currentUser.userId },
      data: {
        nom: dto.nom.trim(),
        prenom: dto.prenom?.trim() || null,
        email,
      },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        telephone: true,
        actif: true,
        companyId: true,
      },
    });
  }

  async getSignature(currentUser: CurrentUserPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: {
        id: true,
        signatureBase64: true,
        signatureUpdatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouve');
    }

    return user;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException('Aucun compte associé à cet email');
    }

    const code = randomBytes(3).toString('hex').toUpperCase();
    const resetCodeHash = createHash('sha256').update(code).digest('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetCodeHash,
        resetCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    await this.mailService.sendPasswordResetCode(user.email, code);

    return { success: true, email: user.email };
  }

  async verifyResetCode(dto: VerifyResetCodeDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const codeHash = createHash('sha256')
      .update(dto.code.trim().toUpperCase())
      .digest('hex');
    if (
      !user ||
      !user.resetCodeHash ||
      !user.resetCodeExpiresAt ||
      user.resetCodeExpiresAt < new Date() ||
      user.resetCodeHash !== codeHash
    ) {
      throw new UnauthorizedException(
        'Code de verification invalide ou expire.',
      );
    }
    return { success: true, email };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const codeHash = createHash('sha256')
      .update(dto.code.trim().toUpperCase())
      .digest('hex');
    if (
      !user ||
      !user.resetCodeHash ||
      !user.resetCodeExpiresAt ||
      user.resetCodeExpiresAt < new Date() ||
      user.resetCodeHash !== codeHash
    ) {
      throw new UnauthorizedException(
        'Code de verification invalide ou expire.',
      );
    }
    const hashedPassword = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        resetCodeHash: null,
        resetCodeExpiresAt: null,
      },
    });

    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  async saveSignature(dto: SaveSignatureDto, currentUser: CurrentUserPayload) {
    this.ensureSignatureBase64(dto.signatureBase64);

    const user = await this.prisma.user.update({
      where: { id: currentUser.userId },
      data: {
        signatureBase64: dto.signatureBase64,
        signatureUpdatedAt: new Date(),
      },
      select: {
        id: true,
        signatureBase64: true,
        signatureUpdatedAt: true,
      },
    });

    return {
      message: 'Signature sauvegardee.',
      user,
    };
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  private generateLoginResponse(user: {
    id: number;
    email: string;
    role: string;
    nom: string;
    prenom: string;
    companyId: number;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        companyId: user.companyId,
      },
    };
  }
}
