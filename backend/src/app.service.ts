import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';
import type { CurrentUserPayload } from './common/interfaces/jwt-payload.interface.js';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async seedDatabase() {
    console.log('🌱 Seeding database...');

    // Create or update company
    const company = await this.prisma.company.upsert({
      where: { siret: '12345678901234' },
      update: {
        nom: 'Bâtiment Pro SARL',
        adresse: '123 Rue de la Construction, 75001 Paris',
        telephone: '0145678900',
        email: 'contact@batiment-pro.fr',
        tvaDefaut: 20.0,
        devise: 'EUR',
      },
      create: {
        nom: 'Bâtiment Pro SARL',
        siret: '12345678901234',
        adresse: '123 Rue de la Construction, 75001 Paris',
        telephone: '0145678900',
        email: 'contact@batiment-pro.fr',
        tvaDefaut: 20.0,
        devise: 'EUR',
      },
    });

    console.log(`✅ Company created/updated: ${company.nom}`);

    const users = [
      {
        nom: 'Admin',
        prenom: 'Super',
        email: 'admin@batiment-pro.fr',
        password: 'Admin@2026!',
        role: 'ADMIN' as const,
        telephone: '0600000001',
      },
      {
        nom: 'Dupont',
        prenom: 'Marc',
        email: 'technico@batiment-pro.fr',
        password: 'Technico@2026!',
        role: 'TECHNICO' as const,
        telephone: '0600000002',
      },
      {
        nom: 'Martin',
        prenom: 'Sophie',
        email: 'assistante@batiment-pro.fr',
        password: 'Assistante@2026!',
        role: 'ASSISTANTE' as const,
        telephone: '0600000003',
      },
      {
        nom: 'Bernard',
        prenom: 'Karim',
        email: 'chef.chantier@batiment-pro.fr',
        password: 'Chantier@2026!',
        role: 'CHEF_CHANTIER' as const,
        telephone: '0600000004',
      },
      {
        nom: 'Sous-traitant',
        prenom: 'Nabil',
        email: 'sous.traitant@batiment-pro.fr',
        password: 'SousTraitant@2026!',
        role: 'SOUS_TRAITANT' as const,
        telephone: '0600000005',
      },
    ];

    const seededUsers = [];

    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      const user = await this.prisma.user.upsert({
        where: { email: userData.email },
        update: {
          companyId: company.id,
          nom: userData.nom,
          prenom: userData.prenom,
          password: hashedPassword,
          role: userData.role,
          telephone: userData.telephone,
          actif: true,
          mustChangePassword: false,
        },
        create: {
          companyId: company.id,
          nom: userData.nom,
          prenom: userData.prenom,
          email: userData.email,
          password: hashedPassword,
          role: userData.role,
          telephone: userData.telephone,
          actif: true,
          mustChangePassword: false,
        },
      });

      seededUsers.push({
        email: user.email,
        password: userData.password,
        role: user.role,
      });

      console.log(`✅ User created/updated: ${user.email} (${user.role})`);
    }

    return {
      message: '✅ Database seeded successfully!',
      company: company.nom,
      users: seededUsers,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Dashboard Admin – statistiques P0
  // ─────────────────────────────────────────────────────────────
  async getDashboardStats(user: CurrentUserPayload) {
    const companyId = user.companyId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── 1. Prospects actifs (30 jours) = demandes de devis créées dans les 30 derniers jours
    const prospectsActifs = await this.prisma.demandeDevis.count({
      where: {
        companyId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // ── 2. Devis envoyés / acceptés / refusés (tous temps pour graphique)
    const [
      devisEnvoyes,
      devisAcceptes,
      devisRefuses,
      devisBrouillons,
      devisSigne,
    ] = await Promise.all([
      this.prisma.devis.count({ where: { companyId, statut: 'ENVOYE' } }),
      this.prisma.devis.count({ where: { companyId, statut: 'ACCEPTE' } }),
      this.prisma.devis.count({ where: { companyId, statut: 'REFUSE' } }),
      this.prisma.devis.count({ where: { companyId, statut: 'BROUILLON' } }),
      this.prisma.devis.count({ where: { companyId, statut: 'SIGNE' } }),
    ]);

    // ── 3. Taux de conversion & CA signé du mois
    const totalDevisEnvoye =
      devisEnvoyes + devisAcceptes + devisRefuses + devisSigne;

    const tauxConversion =
      totalDevisEnvoye > 0
        ? Math.round(((devisAcceptes + devisSigne) / totalDevisEnvoye) * 100)
        : 0;

    // CA signé = somme des totalTTC des devis SIGNE/ACCEPTE créés ce mois
    const caSigneMoisResult = await this.prisma.devis.aggregate({
      where: {
        companyId,
        statut: { in: ['SIGNE', 'ACCEPTE'] },
        dateValidation: { gte: startOfMonth },
      },
      _sum: { totalTTC: true },
    });

    const caSigneMois = caSigneMoisResult._sum.totalTTC ?? 0;

    // ── 4. Factures impayées (statut ENVOYEE)
    const [facturesImpayeesResult, facturesImpayeesNombre] =
      await Promise.all([
        this.prisma.facture.aggregate({
          where: {
            statut: 'ENVOYEE',
            devis: {
              companyId,
            },
          },
          _sum: {
            montantTTC: true,
          },
        }),

        this.prisma.facture.count({
          where: {
            statut: 'ENVOYEE',
            devis: {
              companyId,
            },
          },
        }),
      ]);

    const facturesImpayeesMontant =
      facturesImpayeesResult._sum.montantTTC ?? 0;

    // ── 5. Chantiers en retard : dateFin dépassée et statut pas TERMINE/CLOTURE
    const chantiersEnRetard = await this.prisma.chantier.count({
      where: {
        companyId,
        statut: { notIn: ['TERMINE', 'CLOTURE'] },
        dateFin: { lt: now },
      },
    });

    // ── 6. Commandes fournisseur en attente
    const commandesEnAttente = await this.prisma.commandeFournisseur.count({
      where: {
        statutLivraison: {
          in: ['CREEE', 'ENVOYEE'],
        },
        devis: {
          companyId,
        },
      },
    });

    // ── 7. Marge moyenne par devis
    const margeDevisResult = await this.prisma.devis.aggregate({
      where: {
        companyId,
        coutTotal: { gt: 0 },
      },
      _avg: { margePourcent: true },
    });

    const margeMoyenneDevis = Math.round(
      margeDevisResult._avg.margePourcent ?? 0,
    );

    return {
      prospectsActifs,
      devis: {
        envoyes: devisEnvoyes,
        acceptes: devisAcceptes,
        refuses: devisRefuses,
        brouillons: devisBrouillons,
        signes: devisSigne,
      },
      tauxConversion,
      caSigneMois,
      facturesImpayees: {
        montant: facturesImpayeesMontant,
        nombre: facturesImpayeesNombre,
      },
      chantiersEnRetard,
      commandesEnAttente,
      margeMoyenneDevis,
    };
  }
}