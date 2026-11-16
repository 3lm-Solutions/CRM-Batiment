import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Liste tous les utilisateurs de la même entreprise (companyId)
   * Étape 6 : isolation SaaS — filtre par companyId
   */
  async findAll(currentUser: CurrentUserPayload) {
    return this.prisma.user.findMany({
      where: { companyId: currentUser.companyId },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        telephone: true,
        actif: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récupère un utilisateur par ID (même companyId uniquement)
   */
  async findOne(id: number, currentUser: CurrentUserPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id },
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
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur #${id} non trouvé`);
    }

    // Isolation SaaS : vérifier que l'utilisateur appartient à la même entreprise
    if (user.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé à cet utilisateur');
    }

    return user;
  }

  /**
   * Mettre à jour un utilisateur (Admin de la même entreprise)
   */
  async update(
    id: number,
    dto: UpdateUserDto,
    currentUser: CurrentUserPayload,
  ) {
    // Vérifier existence et isolation SaaS
    await this.findOne(id, currentUser);

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        telephone: true,
        actif: true,
        mustChangePassword: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Désactiver un utilisateur (soft delete : actif = false)
   */
  async deactivate(id: number, currentUser: CurrentUserPayload) {
    // Vérifier existence et isolation SaaS
    const user = await this.findOne(id, currentUser);

    // Empêcher un admin de se désactiver lui-même
    if (user.id === currentUser.userId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas désactiver votre propre compte',
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: { actif: false },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        actif: true,
      },
    });
  }

  /**
   * Supprimer définitivement un utilisateur (hard delete)
   * Réservé aux admins. Impossible de supprimer son propre compte ou un autre admin.
   */
  async hardDelete(id: number, currentUser: CurrentUserPayload) {
    const user = await this.findOne(id, currentUser);

    if (user.id === currentUser.userId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas supprimer votre propre compte.',
      );
    }

    if (user.role === 'ADMIN') {
      throw new ForbiddenException(
        'Impossible de supprimer un compte administrateur.',
      );
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: `Utilisateur #${id} supprimé définitivement.` };
  }
}
