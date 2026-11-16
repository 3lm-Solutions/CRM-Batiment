import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';

type UniteSeed =
  | 'M2'
  | 'ML'
  | 'PIECE'
  | 'JOUR'
  | 'HEURE'
  | 'LITRE'
  | 'KG'
  | 'FORFAIT';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);
  private readonly seedTag = '[SEED_DEMO_FR_2026]';

  constructor(private prisma: PrismaService) {}

  private async ensureFournisseur(
    companyId: number,
    payload: {
      nom: string;
      contact: string;
      email: string;
      telephone: string;
      adresse: string;
      typesMateriaux: string;
      delaiLivraison: number;
    },
  ) {
    const existing = await this.prisma.fournisseur.findFirst({
      where: {
        companyId,
        nom: payload.nom,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.fournisseur.create({
      data: {
        companyId,
        nom: payload.nom,
        contact: payload.contact,
        email: payload.email,
        telephone: payload.telephone,
        adresse: payload.adresse,
        typesMateriaux: payload.typesMateriaux,
        delaiLivraison: payload.delaiLivraison,
        conditions: 'Paiement 30 jours fin de mois',
        actif: true,
      },
    });
  }

  private async ensureMateriau(
    companyId: number,
    payload: {
      nom: string;
      couleur?: string;
      finition?: string;
      unite: UniteSeed;
      prixAchatFixe: number;
      fournisseurId?: number;
    },
  ) {
    const existing = await this.prisma.materiau.findFirst({
      where: {
        companyId,
        nom: payload.nom,
        unite: payload.unite,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.materiau.create({
      data: {
        companyId,
        nom: payload.nom,
        couleur: payload.couleur,
        finition: payload.finition,
        unite: payload.unite,
        prixAchatFixe: payload.prixAchatFixe,
        fournisseurId: payload.fournisseurId,
        actif: true,
      },
    });
  }

  private async ensureServiceMainOeuvre(
    companyId: number,
    payload: {
      nom: string;
      unite: UniteSeed;
      prixUnitaire: number;
      productiviteJour: number;
      coutJournalier: number;
    },
  ) {
    const existing = await this.prisma.serviceMainOeuvre.findFirst({
      where: {
        companyId,
        nom: payload.nom,
        unite: payload.unite,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.serviceMainOeuvre.create({
      data: {
        companyId,
        nom: payload.nom,
        unite: payload.unite,
        prixUnitaire: payload.prixUnitaire,
        productiviteJour: payload.productiviteJour,
        coutJournalier: payload.coutJournalier,
        actif: true,
      },
    });
  }

  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }

  private async ensurePrestationComposition(payload: {
    prestationId: number;
    materiauId?: number;
    serviceMainOeuvreId?: number;
    quantiteParUnite: number;
  }) {
    const existing = await this.prisma.prestationComposition.findFirst({
      where: {
        prestationId: payload.prestationId,
        materiauId: payload.materiauId ?? null,
        serviceMainOeuvreId: payload.serviceMainOeuvreId ?? null,
      },
    });

    if (existing) {
      return this.prisma.prestationComposition.update({
        where: { id: existing.id },
        data: {
          quantiteParUnite: payload.quantiteParUnite,
        },
      });
    }

    return this.prisma.prestationComposition.create({
      data: {
        prestationId: payload.prestationId,
        materiauId: payload.materiauId,
        serviceMainOeuvreId: payload.serviceMainOeuvreId,
        quantiteParUnite: payload.quantiteParUnite,
      },
    });
  }

  private async ensureChoixOptionComposition(payload: {
    choixOptionId: number;
    materiauId?: number;
    serviceMainOeuvreId?: number;
    quantiteParUnite: number;
  }) {
    const existing = await this.prisma.choixOptionComposition.findFirst({
      where: {
        choixOptionId: payload.choixOptionId,
        materiauId: payload.materiauId ?? null,
        serviceMainOeuvreId: payload.serviceMainOeuvreId ?? null,
      },
    });

    if (existing) {
      return this.prisma.choixOptionComposition.update({
        where: { id: existing.id },
        data: {
          quantiteParUnite: payload.quantiteParUnite,
        },
      });
    }

    return this.prisma.choixOptionComposition.create({
      data: {
        choixOptionId: payload.choixOptionId,
        materiauId: payload.materiauId,
        serviceMainOeuvreId: payload.serviceMainOeuvreId,
        quantiteParUnite: payload.quantiteParUnite,
      },
    });
  }

  async seedDatabase() {
    this.logger.log('🌱 Seeding database...');

    try {
      // 1. Create default company
      const company = await this.prisma.company.upsert({
        where: { siret: '12345678901234' },
        update: {},
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
      this.logger.log(`✅ Company created: ${company.nom}`);

      // 2. Create admin account
      const adminPassword = await bcrypt.hash('Admin@2026!', 12);
      const admin = await this.prisma.user.upsert({
        where: { email: 'admin@batiment-pro.fr' },
        update: {},
        create: {
          companyId: company.id,
          nom: 'Admin',
          prenom: 'Super',
          email: 'admin@batiment-pro.fr',
          password: adminPassword,
          role: 'ADMIN',
          actif: true,
          mustChangePassword: false,
        },
      });
      this.logger.log(`✅ Admin created: ${admin.email}`);

      // 3. Create technico account
      const technicoPassword = await bcrypt.hash('Technico@2026!', 12);
      const technico = await this.prisma.user.upsert({
        where: { email: 'technico@batiment-pro.fr' },
        update: {},
        create: {
          companyId: company.id,
          nom: 'Dupont',
          prenom: 'Marc',
          email: 'technico@batiment-pro.fr',
          password: technicoPassword,
          role: 'TECHNICO',
          telephone: '0678901234',
          actif: true,
          mustChangePassword: false,
        },
      });
      this.logger.log(`✅ Technico created: ${technico.email}`);

      // 4. Project types (used by clients)
      const typeProjetNoms = [
        {
          nom: 'Rénovation appartement',
          description: 'Travaux de rénovation intérieure complète',
        },
        {
          nom: 'Maison individuelle',
          description: 'Construction et extension de maison individuelle',
        },
        {
          nom: 'Local commercial',
          description: 'Aménagement de boutiques et bureaux',
        },
        {
          nom: 'Isolation énergétique',
          description: "Travaux d'amélioration énergétique",
        },
      ];

      const typeProjetMap = new Map<string, number>();
      for (const tp of typeProjetNoms) {
        const created = await this.prisma.typeProjet.upsert({
          where: {
            companyId_nom: {
              companyId: company.id,
              nom: tp.nom,
            },
          },
          update: {
            description: tp.description,
            actif: true,
          },
          create: {
            companyId: company.id,
            nom: tp.nom,
            description: tp.description,
            actif: true,
          },
        });
        typeProjetMap.set(created.nom, created.id);
      }
      this.logger.log(`✅ ${typeProjetMap.size} types de projet prêts`);

      // 5. Suppliers
      const fournisseursSeed = [
        {
          nom: 'Point.P Paris Est',
          contact: 'Sophie Martin',
          email: 'pro.parisest@pointp.fr',
          telephone: '0148001122',
          adresse: '12 Avenue Jean Jaurès, 75019 Paris',
          typesMateriaux: 'Maçonnerie, Isolation, Cloisons',
          delaiLivraison: 2,
        },
        {
          nom: 'Rexel France Pro',
          contact: 'Nicolas Bernard',
          email: 'agence.paris11@rexel.fr',
          telephone: '0147002233',
          adresse: '5 Rue de Charonne, 75011 Paris',
          typesMateriaux: 'Électricité, Éclairage, Tableaux',
          delaiLivraison: 1,
        },
        {
          nom: 'CEDEO Bâtiment',
          contact: 'Amine Belkacem',
          email: 'ce-paris@cedeo.fr',
          telephone: '0158003344',
          adresse: '90 Boulevard Ney, 75018 Paris',
          typesMateriaux: 'Plomberie, Sanitaire, Chauffage',
          delaiLivraison: 2,
        },
        {
          nom: 'Dispano Menuiserie',
          contact: 'Julien Robert',
          email: 'pro.idf@dispano.fr',
          telephone: '0142005566',
          adresse: '48 Route de Saint-Denis, 93200 Saint-Denis',
          typesMateriaux: 'Menuiserie, Portes, Fenêtres',
          delaiLivraison: 4,
        },
      ];

      const fournisseurByNom = new Map<string, number>();
      for (const fournisseur of fournisseursSeed) {
        const created = await this.ensureFournisseur(company.id, fournisseur);
        fournisseurByNom.set(created.nom, created.id);
      }
      this.logger.log(`✅ ${fournisseurByNom.size} fournisseurs configurés`);

      // 6. Professional catalogue (categories, sous-categories, prestations)
      const categories = [
        {
          nom: 'Gros Œuvre',
          description: 'Structure, maçonnerie, cloisons et supports',
          sousCategories: [
            {
              nom: 'Maçonnerie',
              prestations: [
                {
                  nom: 'Montage cloison placo',
                  unite: 'M2' as UniteSeed,
                  prixVenteMin: 45,
                  prixVenteMax: 72,
                },
                {
                  nom: 'Démolition cloison intérieure',
                  unite: 'M2' as UniteSeed,
                  prixVenteMin: 18,
                  prixVenteMax: 35,
                },
                {
                  nom: 'Réalisation chape béton',
                  unite: 'M2' as UniteSeed,
                  prixVenteMin: 35,
                  prixVenteMax: 58,
                },
              ],
            },
          ],
        },
        {
          nom: 'Revêtements & Peinture',
          description: 'Sols, murs et finitions décoratives',
          sousCategories: [
            {
              nom: 'Carrelage',
              prestations: [
                {
                  nom: 'Pose carrelage sol',
                  unite: 'M2' as UniteSeed,
                  prixVenteMin: 48,
                  prixVenteMax: 85,
                },
                {
                  nom: 'Pose carrelage mural',
                  unite: 'M2' as UniteSeed,
                  prixVenteMin: 52,
                  prixVenteMax: 95,
                },
                {
                  nom: 'Pose faïence salle de bain',
                  unite: 'M2' as UniteSeed,
                  prixVenteMin: 58,
                  prixVenteMax: 102,
                },
              ],
            },
            {
              nom: 'Peinture',
              prestations: [
                {
                  nom: 'Peinture murs 2 couches',
                  unite: 'M2' as UniteSeed,
                  prixVenteMin: 22,
                  prixVenteMax: 36,
                },
                {
                  nom: 'Peinture plafonds 2 couches',
                  unite: 'M2' as UniteSeed,
                  prixVenteMin: 24,
                  prixVenteMax: 38,
                },
                {
                  nom: 'Enduit et préparation support',
                  unite: 'M2' as UniteSeed,
                  prixVenteMin: 18,
                  prixVenteMax: 30,
                },
              ],
            },
          ],
        },
        {
          nom: 'Plomberie & Sanitaire',
          description: 'Installations sanitaires et réseaux eau',
          sousCategories: [
            {
              nom: 'Sanitaire',
              prestations: [
                {
                  nom: 'Pose ensemble WC',
                  unite: 'PIECE' as UniteSeed,
                  prixVenteMin: 280,
                  prixVenteMax: 520,
                },
                {
                  nom: 'Pose receveur et paroi de douche',
                  unite: 'PIECE' as UniteSeed,
                  prixVenteMin: 420,
                  prixVenteMax: 760,
                },
                {
                  nom: 'Pose meuble vasque',
                  unite: 'PIECE' as UniteSeed,
                  prixVenteMin: 250,
                  prixVenteMax: 540,
                },
              ],
            },
            {
              nom: 'Réseau plomberie',
              prestations: [
                {
                  nom: 'Réseau PER multicouche',
                  unite: 'ML' as UniteSeed,
                  prixVenteMin: 28,
                  prixVenteMax: 52,
                },
                {
                  nom: 'Raccordement évacuation PVC',
                  unite: 'ML' as UniteSeed,
                  prixVenteMin: 24,
                  prixVenteMax: 46,
                },
              ],
            },
          ],
        },
        {
          nom: 'Électricité',
          description: 'Câblage, appareillage et tableaux',
          sousCategories: [
            {
              nom: 'Distribution',
              prestations: [
                {
                  nom: 'Pose tableau électrique 2 rangées',
                  unite: 'PIECE' as UniteSeed,
                  prixVenteMin: 780,
                  prixVenteMax: 1400,
                },
                {
                  nom: 'Création circuit prises 16A',
                  unite: 'PIECE' as UniteSeed,
                  prixVenteMin: 90,
                  prixVenteMax: 160,
                },
                {
                  nom: 'Pose points lumineux LED',
                  unite: 'PIECE' as UniteSeed,
                  prixVenteMin: 45,
                  prixVenteMax: 90,
                },
              ],
            },
          ],
        },
        {
          nom: 'Menuiserie',
          description: 'Portes, fenêtres et agencements',
          sousCategories: [
            {
              nom: 'Fermetures',
              prestations: [
                {
                  nom: 'Pose porte intérieure',
                  unite: 'PIECE' as UniteSeed,
                  prixVenteMin: 220,
                  prixVenteMax: 420,
                },
                {
                  nom: 'Pose fenêtre PVC',
                  unite: 'PIECE' as UniteSeed,
                  prixVenteMin: 350,
                  prixVenteMax: 690,
                },
              ],
            },
          ],
        },
        {
          nom: 'Isolation énergétique',
          description: 'Isolation murs, plafonds et combles',
          sousCategories: [
            {
              nom: 'Isolation intérieure',
              prestations: [
                {
                  nom: 'Isolation laine de verre 100mm',
                  unite: 'M2' as UniteSeed,
                  prixVenteMin: 32,
                  prixVenteMax: 56,
                },
                {
                  nom: 'Isolation combles soufflage',
                  unite: 'M2' as UniteSeed,
                  prixVenteMin: 24,
                  prixVenteMax: 42,
                },
              ],
            },
          ],
        },
      ];

      for (const categorySeed of categories) {
        const category = await this.prisma.categoriePrestation.upsert({
          where: {
            companyId_nom: {
              companyId: company.id,
              nom: categorySeed.nom,
            },
          },
          update: {
            description: categorySeed.description,
            actif: true,
          },
          create: {
            companyId: company.id,
            nom: categorySeed.nom,
            description: categorySeed.description,
            actif: true,
          },
        });

        for (const sousCategorieSeed of categorySeed.sousCategories) {
          const sousCategorie = await this.prisma.sousCategorie.upsert({
            where: {
              categorieId_nom: {
                categorieId: category.id,
                nom: sousCategorieSeed.nom,
              },
            },
            update: {
              actif: true,
            },
            create: {
              companyId: company.id,
              categorieId: category.id,
              nom: sousCategorieSeed.nom,
              actif: true,
            },
          });

          for (const prestationSeed of sousCategorieSeed.prestations) {
            const existingPrestation = await this.prisma.prestation.findFirst({
              where: {
                companyId: company.id,
                categorieId: category.id,
                sousCategorieId: sousCategorie.id,
                nom: prestationSeed.nom,
              },
            });

            if (!existingPrestation) {
              await this.prisma.prestation.create({
                data: {
                  companyId: company.id,
                  categorieId: category.id,
                  sousCategorieId: sousCategorie.id,
                  nom: prestationSeed.nom,
                  unite: prestationSeed.unite,
                  prixVenteMin: prestationSeed.prixVenteMin,
                  prixVenteMax: prestationSeed.prixVenteMax,
                  description: `Tarif indicatif marché France 2026. ${this.seedTag}`,
                  actif: true,
                },
              });
            }
          }
        }
      }
      this.logger.log('✅ Catalogue prestations enrichi');

      // 6.b Diagnostic content: questions + infos requises + options
      const peintureCategory = await this.prisma.categoriePrestation.findFirst({
        where: { companyId: company.id, nom: 'Revêtements & Peinture' },
      });
      const peintureSousCategory = await this.prisma.sousCategorie.findFirst({
        where: {
          companyId: company.id,
          nom: 'Peinture',
          categorieId: peintureCategory?.id,
        },
      });

      const peinturePrestation = await this.prisma.prestation.findFirst({
        where: {
          companyId: company.id,
          nom: 'Peinture murs 2 couches',
          categorieId: peintureCategory?.id,
          sousCategorieId: peintureSousCategory?.id,
        },
      });

      const carrelagePrestation = await this.prisma.prestation.findFirst({
        where: {
          companyId: company.id,
          nom: 'Pose carrelage sol',
        },
      });

      if (peinturePrestation) {
        const finitionOption = await this.prisma.optionPrestation.upsert({
          where: {
            prestationId_nom: {
              prestationId: peinturePrestation.id,
              nom: 'Finition peinture',
            },
          },
          create: {
            prestationId: peinturePrestation.id,
            nom: 'Finition peinture',
            description: 'Choisir la finition désirée',
            obligatoire: true,
            ordre: 1,
          },
          update: {
            description: 'Choisir la finition désirée',
            obligatoire: true,
            ordre: 1,
          },
        });

        const protectionOption = await this.prisma.optionPrestation.upsert({
          where: {
            prestationId_nom: {
              prestationId: peinturePrestation.id,
              nom: 'Protection chantier',
            },
          },
          create: {
            prestationId: peinturePrestation.id,
            nom: 'Protection chantier',
            description: 'Protection renforcée des sols et mobiliers',
            obligatoire: false,
            ordre: 2,
          },
          update: {
            description: 'Protection renforcée des sols et mobiliers',
            obligatoire: false,
            ordre: 2,
          },
        });

        const finitionChoix = [
          { nom: 'Mat', impactPrix: 0, ordre: 1 },
          { nom: 'Satin', impactPrix: 2.5, ordre: 2 },
          { nom: 'Velours', impactPrix: 4.0, ordre: 3 },
        ];
        for (const choix of finitionChoix) {
          await this.prisma.choixOption.upsert({
            where: {
              optionId_nom: {
                optionId: finitionOption.id,
                nom: choix.nom,
              },
            },
            create: {
              optionId: finitionOption.id,
              nom: choix.nom,
              impactPrix: choix.impactPrix,
              actif: true,
              ordre: choix.ordre,
            },
            update: {
              impactPrix: choix.impactPrix,
              actif: true,
              ordre: choix.ordre,
            },
          });
        }

        const protectionChoix = [
          { nom: 'Standard', impactPrix: 0, ordre: 1 },
          { nom: 'Renforcée', impactPrix: 3.5, ordre: 2 },
        ];
        for (const choix of protectionChoix) {
          await this.prisma.choixOption.upsert({
            where: {
              optionId_nom: {
                optionId: protectionOption.id,
                nom: choix.nom,
              },
            },
            create: {
              optionId: protectionOption.id,
              nom: choix.nom,
              impactPrix: choix.impactPrix,
              actif: true,
              ordre: choix.ordre,
            },
            update: {
              impactPrix: choix.impactPrix,
              actif: true,
              ordre: choix.ordre,
            },
          });
        }
      }

      if (carrelagePrestation) {
        const existingOption = await this.prisma.optionPrestation.findFirst({
          where: {
            prestationId: carrelagePrestation.id,
            nom: 'Format carrelage',
          },
        });

        const formatOption = existingOption
          ? existingOption
          : await this.prisma.optionPrestation.create({
              data: {
                prestationId: carrelagePrestation.id,
                nom: 'Format carrelage',
                description: 'Choix du format de carreau',
                obligatoire: true,
                ordre: 1,
              },
            });

        const carrelageChoix = [
          { nom: '30x30', impactPrix: 0, ordre: 1 },
          { nom: '60x60', impactPrix: 5, ordre: 2 },
          { nom: 'Grand format', impactPrix: 12, ordre: 3 },
        ];

        for (const choix of carrelageChoix) {
          await this.prisma.choixOption.upsert({
            where: {
              optionId_nom: {
                optionId: formatOption.id,
                nom: choix.nom,
              },
            },
            create: {
              optionId: formatOption.id,
              nom: choix.nom,
              impactPrix: choix.impactPrix,
              actif: true,
              ordre: choix.ordre,
            },
            update: {
              impactPrix: choix.impactPrix,
              actif: true,
              ordre: choix.ordre,
            },
          });
        }
      }
      this.logger.log(
        '✅ Questions, infos requises et options de diagnostic prêtes',
      );

      // 7. Materials based on current France market references
      const materiauxSeed = [
        {
          nom: 'Carrelage grès cérame 60x60',
          couleur: 'Gris anthracite',
          finition: 'Mat',
          unite: 'M2' as UniteSeed,
          prixAchatFixe: 18.5,
          fournisseur: 'Point.P Paris Est',
        },
        {
          nom: 'Faïence murale 30x60',
          couleur: 'Blanc',
          finition: 'Brillant',
          unite: 'M2' as UniteSeed,
          prixAchatFixe: 16.0,
          fournisseur: 'Point.P Paris Est',
        },
        {
          nom: 'Colle carrelage C2 (25kg)',
          unite: 'KG' as UniteSeed,
          prixAchatFixe: 12.5,
          fournisseur: 'Point.P Paris Est',
        },
        {
          nom: 'Peinture acrylique mat 10L',
          couleur: 'Blanc',
          finition: 'Mat',
          unite: 'LITRE' as UniteSeed,
          prixAchatFixe: 45.0,
          fournisseur: 'Point.P Paris Est',
        },
        {
          nom: 'Sous-couche universelle 10L',
          couleur: 'Blanc',
          unite: 'LITRE' as UniteSeed,
          prixAchatFixe: 35.0,
          fournisseur: 'Point.P Paris Est',
        },
        {
          nom: 'Receveur douche 80x120',
          couleur: 'Blanc',
          unite: 'PIECE' as UniteSeed,
          prixAchatFixe: 180.0,
          fournisseur: 'CEDEO Bâtiment',
        },
        {
          nom: 'Mitigeur douche thermostatique',
          couleur: 'Chrome',
          finition: 'Brillant',
          unite: 'PIECE' as UniteSeed,
          prixAchatFixe: 120.0,
          fournisseur: 'CEDEO Bâtiment',
        },
        {
          nom: 'Tube PER 16mm',
          unite: 'ML' as UniteSeed,
          prixAchatFixe: 1.2,
          fournisseur: 'CEDEO Bâtiment',
        },
        {
          nom: 'Câble R2V 3G2.5',
          unite: 'ML' as UniteSeed,
          prixAchatFixe: 1.5,
          fournisseur: 'Rexel France Pro',
        },
        {
          nom: 'Prise électrique encastrée',
          couleur: 'Blanc',
          unite: 'PIECE' as UniteSeed,
          prixAchatFixe: 5.5,
          fournisseur: 'Rexel France Pro',
        },
        {
          nom: 'Interrupteur va-et-vient',
          couleur: 'Blanc',
          unite: 'PIECE' as UniteSeed,
          prixAchatFixe: 6.0,
          fournisseur: 'Rexel France Pro',
        },
        {
          nom: 'Tableau électrique 2 rangées',
          unite: 'PIECE' as UniteSeed,
          prixAchatFixe: 85.0,
          fournisseur: 'Rexel France Pro',
        },
        {
          nom: 'Plaque de plâtre BA13',
          unite: 'PIECE' as UniteSeed,
          prixAchatFixe: 6.5,
          fournisseur: 'Point.P Paris Est',
        },
        {
          nom: 'Rail métallique R48',
          unite: 'ML' as UniteSeed,
          prixAchatFixe: 2.0,
          fournisseur: 'Point.P Paris Est',
        },
        {
          nom: 'Laine de verre GR32 100mm',
          unite: 'M2' as UniteSeed,
          prixAchatFixe: 8.0,
          fournisseur: 'Point.P Paris Est',
        },
        {
          nom: 'Bloc porte intérieur 83cm',
          couleur: 'Blanc',
          finition: 'Lisse',
          unite: 'PIECE' as UniteSeed,
          prixAchatFixe: 75.0,
          fournisseur: 'Dispano Menuiserie',
        },
        {
          nom: 'Fenêtre PVC 2 vantaux 120x135',
          couleur: 'Blanc',
          unite: 'PIECE' as UniteSeed,
          prixAchatFixe: 180.0,
          fournisseur: 'Dispano Menuiserie',
        },
        {
          nom: 'Parquet flottant chêne 7mm',
          couleur: 'Chêne naturel',
          finition: 'Verni',
          unite: 'M2' as UniteSeed,
          prixAchatFixe: 12.0,
          fournisseur: 'Dispano Menuiserie',
        },
      ];

      for (const materiau of materiauxSeed) {
        await this.ensureMateriau(company.id, {
          nom: materiau.nom,
          couleur: materiau.couleur,
          finition: materiau.finition,
          unite: materiau.unite,
          prixAchatFixe: materiau.prixAchatFixe,
          fournisseurId: fournisseurByNom.get(materiau.fournisseur),
        });
      }
      this.logger.log(`✅ ${materiauxSeed.length} matériaux chargés`);

      // 8. Labor services (main d'oeuvre)
      const servicesMainOeuvreSeed = [
        {
          nom: 'Pose carrelage sol',
          unite: 'M2' as UniteSeed,
          prixUnitaire: 25,
          productiviteJour: 15,
          coutJournalier: 250,
        },
        {
          nom: 'Pose carrelage mural',
          unite: 'M2' as UniteSeed,
          prixUnitaire: 30,
          productiviteJour: 12,
          coutJournalier: 250,
        },
        {
          nom: 'Peinture mur (2 couches)',
          unite: 'M2' as UniteSeed,
          prixUnitaire: 8,
          productiviteJour: 25,
          coutJournalier: 220,
        },
        {
          nom: 'Plomberie - pose sanitaire',
          unite: 'HEURE' as UniteSeed,
          prixUnitaire: 45,
          productiviteJour: 8,
          coutJournalier: 280,
        },
        {
          nom: 'Plomberie - raccordement',
          unite: 'HEURE' as UniteSeed,
          prixUnitaire: 50,
          productiviteJour: 8,
          coutJournalier: 280,
        },
        {
          nom: 'Electricite - cablage',
          unite: 'HEURE' as UniteSeed,
          prixUnitaire: 45,
          productiviteJour: 8,
          coutJournalier: 270,
        },
        {
          nom: 'Electricite - pose appareillage',
          unite: 'PIECE' as UniteSeed,
          prixUnitaire: 15,
          productiviteJour: 20,
          coutJournalier: 270,
        },
        {
          nom: 'Montage cloison placo',
          unite: 'M2' as UniteSeed,
          prixUnitaire: 20,
          productiviteJour: 12,
          coutJournalier: 240,
        },
        {
          nom: 'Isolation laine de verre',
          unite: 'M2' as UniteSeed,
          prixUnitaire: 12,
          productiviteJour: 20,
          coutJournalier: 230,
        },
        {
          nom: 'Pose parquet flottant',
          unite: 'M2' as UniteSeed,
          prixUnitaire: 12,
          productiviteJour: 20,
          coutJournalier: 230,
        },
        {
          nom: 'Pose porte interieure',
          unite: 'PIECE' as UniteSeed,
          prixUnitaire: 80,
          productiviteJour: 3,
          coutJournalier: 250,
        },
        {
          nom: 'Pose fenetre',
          unite: 'PIECE' as UniteSeed,
          prixUnitaire: 120,
          productiviteJour: 2,
          coutJournalier: 260,
        },
      ];

      for (const service of servicesMainOeuvreSeed) {
        await this.ensureServiceMainOeuvre(company.id, service);
      }
      this.logger.log(
        `✅ ${servicesMainOeuvreSeed.length} services main d'oeuvre chargés`,
      );

      // 9. Compositions de base pour permettre un calcul réel des coûts
      const peintureMurPrestation = await this.prisma.prestation.findFirst({
        where: { companyId: company.id, nom: 'Peinture murs 2 couches' },
      });
      const carrelageSolPrestation = await this.prisma.prestation.findFirst({
        where: { companyId: company.id, nom: 'Pose carrelage sol' },
      });
      const reseauPerPrestation = await this.prisma.prestation.findFirst({
        where: { companyId: company.id, nom: 'Réseau PER multicouche' },
      });
      const prisePrestation = await this.prisma.prestation.findFirst({
        where: { companyId: company.id, nom: 'Création circuit prises 16A' },
      });

      const peintureAcrylique = await this.prisma.materiau.findFirst({
        where: { companyId: company.id, nom: 'Peinture acrylique mat 10L' },
      });
      const sousCouche = await this.prisma.materiau.findFirst({
        where: { companyId: company.id, nom: 'Sous-couche universelle 10L' },
      });
      const carreauSol = await this.prisma.materiau.findFirst({
        where: { companyId: company.id, nom: 'Carrelage grès cérame 60x60' },
      });
      const colleCarrelage = await this.prisma.materiau.findFirst({
        where: { companyId: company.id, nom: 'Colle carrelage C2 (25kg)' },
      });
      const tubePer = await this.prisma.materiau.findFirst({
        where: { companyId: company.id, nom: 'Tube PER 16mm' },
      });
      const cableR2v = await this.prisma.materiau.findFirst({
        where: { companyId: company.id, nom: 'Câble R2V 3G2.5' },
      });
      const priseEncastree = await this.prisma.materiau.findFirst({
        where: { companyId: company.id, nom: 'Prise électrique encastrée' },
      });

      const servicePeinture = await this.prisma.serviceMainOeuvre.findFirst({
        where: { companyId: company.id, nom: 'Peinture mur (2 couches)' },
      });
      const serviceCarrelage = await this.prisma.serviceMainOeuvre.findFirst({
        where: { companyId: company.id, nom: 'Pose carrelage sol' },
      });
      const servicePlomberie = await this.prisma.serviceMainOeuvre.findFirst({
        where: { companyId: company.id, nom: 'Plomberie - raccordement' },
      });
      const serviceElectricite = await this.prisma.serviceMainOeuvre.findFirst({
        where: {
          companyId: company.id,
          nom: 'Electricite - pose appareillage',
        },
      });

      if (
        peintureMurPrestation &&
        peintureAcrylique &&
        sousCouche &&
        servicePeinture
      ) {
        await this.ensurePrestationComposition({
          prestationId: peintureMurPrestation.id,
          materiauId: peintureAcrylique.id,
          quantiteParUnite: 0.18,
        });
        await this.ensurePrestationComposition({
          prestationId: peintureMurPrestation.id,
          materiauId: sousCouche.id,
          quantiteParUnite: 0.08,
        });
        await this.ensurePrestationComposition({
          prestationId: peintureMurPrestation.id,
          serviceMainOeuvreId: servicePeinture.id,
          quantiteParUnite: 1,
        });
      }

      if (
        carrelageSolPrestation &&
        carreauSol &&
        colleCarrelage &&
        serviceCarrelage
      ) {
        await this.ensurePrestationComposition({
          prestationId: carrelageSolPrestation.id,
          materiauId: carreauSol.id,
          quantiteParUnite: 1.05,
        });
        await this.ensurePrestationComposition({
          prestationId: carrelageSolPrestation.id,
          materiauId: colleCarrelage.id,
          quantiteParUnite: 0.22,
        });
        await this.ensurePrestationComposition({
          prestationId: carrelageSolPrestation.id,
          serviceMainOeuvreId: serviceCarrelage.id,
          quantiteParUnite: 1,
        });
      }

      if (reseauPerPrestation && tubePer && servicePlomberie) {
        await this.ensurePrestationComposition({
          prestationId: reseauPerPrestation.id,
          materiauId: tubePer.id,
          quantiteParUnite: 1.15,
        });
        await this.ensurePrestationComposition({
          prestationId: reseauPerPrestation.id,
          serviceMainOeuvreId: servicePlomberie.id,
          quantiteParUnite: 1,
        });
      }

      if (prisePrestation && cableR2v && priseEncastree && serviceElectricite) {
        await this.ensurePrestationComposition({
          prestationId: prisePrestation.id,
          materiauId: cableR2v.id,
          quantiteParUnite: 2.8,
        });
        await this.ensurePrestationComposition({
          prestationId: prisePrestation.id,
          materiauId: priseEncastree.id,
          quantiteParUnite: 1,
        });
        await this.ensurePrestationComposition({
          prestationId: prisePrestation.id,
          serviceMainOeuvreId: serviceElectricite.id,
          quantiteParUnite: 1,
        });
      }

      const satinChoice = await this.prisma.choixOption.findFirst({
        where: {
          nom: 'Satin',
          option: {
            prestation: {
              companyId: company.id,
              nom: 'Peinture murs 2 couches',
            },
          },
        },
      });
      const veloursChoice = await this.prisma.choixOption.findFirst({
        where: {
          nom: 'Velours',
          option: {
            prestation: {
              companyId: company.id,
              nom: 'Peinture murs 2 couches',
            },
          },
        },
      });
      const protectionRenforcee = await this.prisma.choixOption.findFirst({
        where: {
          nom: 'Renforcée',
          option: {
            prestation: {
              companyId: company.id,
              nom: 'Peinture murs 2 couches',
            },
          },
        },
      });

      if (satinChoice && peintureAcrylique) {
        await this.ensureChoixOptionComposition({
          choixOptionId: satinChoice.id,
          materiauId: peintureAcrylique.id,
          quantiteParUnite: 0.03,
        });
      }
      if (veloursChoice && peintureAcrylique) {
        await this.ensureChoixOptionComposition({
          choixOptionId: veloursChoice.id,
          materiauId: peintureAcrylique.id,
          quantiteParUnite: 0.05,
        });
      }
      if (protectionRenforcee && servicePeinture) {
        await this.ensureChoixOptionComposition({
          choixOptionId: protectionRenforcee.id,
          serviceMainOeuvreId: servicePeinture.id,
          quantiteParUnite: 0.1,
        });
      }

      // 9.b Liaison systématique prestation -> service main d'oeuvre
      const serviceCatalog = await this.prisma.serviceMainOeuvre.findMany({
        where: { companyId: company.id, actif: true },
        select: { id: true, nom: true },
      });
      const serviceIdByName = new Map(serviceCatalog.map((s) => [s.nom, s.id]));

      const allPrestations = await this.prisma.prestation.findMany({
        where: { companyId: company.id, actif: true },
        select: { id: true, nom: true, unite: true },
      });

      const pickServiceForPrestation = (prestationNom: string) => {
        const nom = prestationNom.toLowerCase();

        if (nom.includes('carrelage mural'))
          return serviceIdByName.get('Pose carrelage mural');
        if (
          nom.includes('carrelage') ||
          nom.includes('faïence') ||
          nom.includes('faience')
        )
          return serviceIdByName.get('Pose carrelage sol');
        if (nom.includes('peinture') || nom.includes('enduit'))
          return serviceIdByName.get('Peinture mur (2 couches)');

        if (
          nom.includes('wc') ||
          nom.includes('douche') ||
          nom.includes('vasque')
        )
          return serviceIdByName.get('Plomberie - pose sanitaire');
        if (
          nom.includes('réseau') ||
          nom.includes('reseau') ||
          nom.includes('évacuation') ||
          nom.includes('evacuation') ||
          nom.includes('raccordement')
        )
          return serviceIdByName.get('Plomberie - raccordement');

        if (
          nom.includes('tableau') ||
          nom.includes('circuit') ||
          nom.includes('prises') ||
          nom.includes('lumineux')
        )
          return serviceIdByName.get('Electricite - pose appareillage');
        if (nom.includes('cloison') || nom.includes('chape'))
          return serviceIdByName.get('Montage cloison placo');
        if (nom.includes('isolation'))
          return serviceIdByName.get('Isolation laine de verre');
        if (nom.includes('porte'))
          return serviceIdByName.get('Pose porte interieure');
        if (nom.includes('fenêtre') || nom.includes('fenetre'))
          return serviceIdByName.get('Pose fenetre');

        return undefined;
      };

      for (const prestation of allPrestations) {
        const serviceMainOeuvreId = pickServiceForPrestation(prestation.nom);
        if (!serviceMainOeuvreId) {
          continue;
        }

        await this.ensurePrestationComposition({
          prestationId: prestation.id,
          serviceMainOeuvreId: serviceMainOeuvreId as number,
          quantiteParUnite: 1,
        });
      }

      this.logger.log(
        '✅ Compositions techniques créées pour le calcul des devis',
      );

      // 10. Sample clients and quote requests for realistic dashboard
      const clientsSeed = [
        {
          nom: 'Leroy',
          prenom: 'Camille',
          email: 'camille.leroy@example.fr',
          telephone: '0611223344',
          adresseClient: '18 Rue Oberkampf, 75011 Paris',
          adresseChantier: '18 Rue Oberkampf, 75011 Paris',
          typeProjetNom: 'Rénovation appartement',
          source: 'SITE_WEB' as const,
          besoin: 'Rénovation complète T3, salle de bain et électricité',
        },
        {
          nom: 'Moreau',
          prenom: 'Antoine',
          email: 'antoine.moreau@example.fr',
          telephone: '0677889900',
          adresseClient: '6 Avenue de la République, 92120 Montrouge',
          adresseChantier: '6 Avenue de la République, 92120 Montrouge',
          typeProjetNom: 'Maison individuelle',
          source: 'RECOMMANDATION' as const,
          besoin: 'Isolation combles et remplacement menuiseries',
        },
        {
          nom: 'Durand',
          prenom: 'Sophie',
          email: 'sophie.durand@example.fr',
          telephone: '0655667788',
          adresseClient: '22 Rue de Rivoli, 75004 Paris',
          adresseChantier: '22 Rue de Rivoli, 75004 Paris',
          typeProjetNom: 'Local commercial',
          source: 'APPEL' as const,
          besoin: 'Remise à neuf boutique avec carrelage et peinture',
        },
        {
          nom: 'Nguyen',
          prenom: 'Minh',
          email: 'minh.nguyen@example.fr',
          telephone: '0699442211',
          adresseClient: '44 Rue Voltaire, 93100 Montreuil',
          adresseChantier: '44 Rue Voltaire, 93100 Montreuil',
          typeProjetNom: 'Isolation énergétique',
          source: 'TECHNICO_COMMERCIAL' as const,
          besoin: 'Audit thermique et isolation murs intérieurs',
        },
      ];

      const clientsCreees: Array<{ id: number; besoin: string }> = [];
      for (const clientSeed of clientsSeed) {
        const existingClient = await this.prisma.client.findFirst({
          where: {
            companyId: company.id,
            email: clientSeed.email,
          },
        });

        const typeProjetId = typeProjetMap.get(clientSeed.typeProjetNom);
        const client = existingClient
          ? existingClient
          : await this.prisma.client.create({
              data: {
                companyId: company.id,
                nom: clientSeed.nom,
                prenom: clientSeed.prenom,
                email: clientSeed.email,
                telephone: clientSeed.telephone,
                adresseClient: clientSeed.adresseClient,
                adresseChantier: clientSeed.adresseChantier,
                typeProjetId,
                typeProjetLinks: typeProjetId
                  ? {
                      create: {
                        typeProjetId,
                      },
                    }
                  : undefined,
                source: clientSeed.source,
                besoin: clientSeed.besoin,
                notes: this.seedTag,
              },
            });

        clientsCreees.push({
          id: client.id,
          besoin: clientSeed.besoin,
        });
      }
      this.logger.log(
        `✅ ${clientsCreees.length} clients de démonstration prêts`,
      );

      for (const client of clientsCreees) {
        const existingDemande = await this.prisma.demandeDevis.findFirst({
          where: {
            companyId: company.id,
            clientId: client.id,
            description: client.besoin,
          },
        });

        if (!existingDemande) {
          await this.prisma.demandeDevis.create({
            data: {
              companyId: company.id,
              clientId: client.id,
              createurId: technico.id,
              source: 'TECHNICO_COMMERCIAL',
              description: client.besoin,
              statut: 'NOUVEAU',
            },
          });
        }
      }
      this.logger.log('✅ Demandes de devis de démo créées');

      // 11. Devis automatiques précis par client (sans sessions diagnostic)
      const prestationsAutoDevis = await this.prisma.prestation.findMany({
        where: {
          companyId: company.id,
          nom: {
            in: [
              'Peinture murs 2 couches',
              'Pose carrelage sol',
              'Réseau PER multicouche',
              'Création circuit prises 16A',
            ],
          },
        },
        include: {
          compositions: {
            include: {
              materiau: true,
              serviceMainOeuvre: true,
            },
          },
          options: {
            include: {
              choix: {
                include: {
                  compositions: {
                    include: {
                      materiau: true,
                      serviceMainOeuvre: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const sortedPrestations = prestationsAutoDevis.sort(
        (a, b) => a.id - b.id,
      );

      for (
        let i = 0;
        i < clientsCreees.length && sortedPrestations.length > 0;
        i++
      ) {
        const clientId = clientsCreees[i].id;
        const prestation = sortedPrestations[i % sortedPrestations.length];

        const existingDevis = await this.prisma.devis.findFirst({
          where: {
            companyId: company.id,
            clientId,
            notes: {
              contains: this.seedTag,
            },
          },
        });

        if (existingDevis) {
          continue;
        }

        const quantite =
          prestation.unite === 'PIECE'
            ? 2
            : prestation.unite === 'FORFAIT'
              ? 1
              : 35 + i * 8;

        const selectedChoices: Array<{
          optionId: number;
          choixId: number;
          impactPrix: number;
          compositions: Array<{
            quantiteParUnite: number;
            materiauPrix?: number;
            servicePrix?: number;
          }>;
        }> = [];

        for (const option of prestation.options) {
          if (!option.choix.length) {
            continue;
          }

          const sortedChoix = [...option.choix].sort(
            (a, b) => a.ordre - b.ordre || a.id - b.id,
          );
          const picked =
            sortedChoix[
              Math.min(i % sortedChoix.length, sortedChoix.length - 1)
            ];

          selectedChoices.push({
            optionId: option.id,
            choixId: picked.id,
            impactPrix: picked.impactPrix,
            compositions: picked.compositions.map((c) => ({
              quantiteParUnite: c.quantiteParUnite,
              materiauPrix: c.materiau?.prixAchatFixe,
              servicePrix: c.serviceMainOeuvre?.prixUnitaire,
            })),
          });
        }

        const baseCostPerUnit = prestation.compositions.reduce((acc, comp) => {
          const matCost = comp.materiau
            ? comp.materiau.prixAchatFixe * comp.quantiteParUnite
            : 0;
          const moCost = comp.serviceMainOeuvre
            ? comp.serviceMainOeuvre.prixUnitaire * comp.quantiteParUnite
            : 0;
          return acc + matCost + moCost;
        }, 0);

        const optionCompCostPerUnit = selectedChoices.reduce((acc, sel) => {
          const selCost = sel.compositions.reduce((sub, comp) => {
            const matCost = (comp.materiauPrix ?? 0) * comp.quantiteParUnite;
            const moCost = (comp.servicePrix ?? 0) * comp.quantiteParUnite;
            return sub + matCost + moCost;
          }, 0);
          return acc + selCost;
        }, 0);

        const optionImpactPerUnit = selectedChoices.reduce(
          (acc, sel) => acc + sel.impactPrix,
          0,
        );
        const coutUnitaire = this.round2(
          baseCostPerUnit + optionCompCostPerUnit,
        );
        const basePrixVente =
          (prestation.prixVenteMin + prestation.prixVenteMax) / 2 +
          optionImpactPerUnit;
        const prixUnitaireVente = this.round2(
          Math.max(
            basePrixVente,
            coutUnitaire > 0 ? coutUnitaire * 1.2 : basePrixVente,
          ),
        );

        const totalHT = this.round2(prixUnitaireVente * quantite);
        const coutTotal = this.round2(coutUnitaire * quantite);
        const totalTVA = this.round2(totalHT * 0.2);
        const totalTTC = this.round2(totalHT + totalTVA);
        const profit = this.round2(totalHT - coutTotal);
        const margePourcent =
          totalHT > 0 ? this.round2((profit / totalHT) * 100) : 0;

        const demandeAssociee = await this.prisma.demandeDevis.findFirst({
          where: { companyId: company.id, clientId },
          orderBy: { id: 'asc' },
        });

        const reference = `DEV-2026-${String(clientId).padStart(4, '0')}`;

        const devis = await this.prisma.devis.create({
          data: {
            companyId: company.id,
            clientId,
            demandeDevisId: demandeAssociee?.id,
            createurId: technico.id,
            reference,
            statut: 'BROUILLON',
            totalHT,
            totalTVA,
            totalTTC,
            coutTotal,
            profit,
            margePourcent,
            tauxTVA: 20,
            notes: `${this.seedTag} | devis auto généré via seed`,
          },
        });

        await this.prisma.ligneDevis.create({
          data: {
            devisId: devis.id,
            prestationId: prestation.id,
            description: `${prestation.nom} - ${quantite} ${prestation.unite}`,
            quantite,
            unite: prestation.unite,
            prixUnitaireVente,
            prixAchat: this.round2(coutUnitaire * 0.65),
            mainOeuvre: this.round2(coutUnitaire * 0.35),
            totalHT,
            coutTotal,
            ordre: 1,
          },
        });

        await this.prisma.versionDevis.create({
          data: {
            devisId: devis.id,
            auteurId: technico.id,
            numeroVersion: 1,
            justification: `${this.seedTag} version initiale`,
            snapshotLignes: {
              lignes: [
                {
                  prestationId: prestation.id,
                  quantite,
                  unite: prestation.unite,
                  prixUnitaireVente,
                  totalHT,
                  coutTotal,
                },
              ],
            },
            totalHT,
            totalTTC,
            profit,
            margePourcent,
          },
        });
      }
      this.logger.log('✅ Devis automatiques générés');

      const categorieCount = await this.prisma.categoriePrestation.count({
        where: { companyId: company.id },
      });
      const sousCategorieCount = await this.prisma.sousCategorie.count({
        where: { companyId: company.id },
      });
      const prestationCount = await this.prisma.prestation.count({
        where: { companyId: company.id },
      });
      const materiauCount = await this.prisma.materiau.count({
        where: { companyId: company.id },
      });
      const serviceMOCount = await this.prisma.serviceMainOeuvre.count({
        where: { companyId: company.id },
      });
      const fournisseurCount = await this.prisma.fournisseur.count({
        where: { companyId: company.id },
      });
      const clientCount = await this.prisma.client.count({
        where: { companyId: company.id },
      });
      const demandeCount = await this.prisma.demandeDevis.count({
        where: { companyId: company.id },
      });
      const compositionCount = await this.prisma.prestationComposition.count({
        where: {
          prestation: {
            companyId: company.id,
          },
        },
      });
      const choixCompositionCount =
        await this.prisma.choixOptionComposition.count({
          where: {
            choixOption: {
              option: {
                prestation: {
                  companyId: company.id,
                },
              },
            },
          },
        });
      const devisCount = await this.prisma.devis.count({
        where: { companyId: company.id },
      });
      const ligneDevisCount = await this.prisma.ligneDevis.count({
        where: {
          devis: {
            companyId: company.id,
          },
        },
      });

      return {
        message: 'Database seeded successfully with professional FR dataset',
        accounts: [
          {
            role: 'ADMIN',
            email: 'admin@batiment-pro.fr',
            password: 'Admin@2026!',
          },
          {
            role: 'TECHNICO',
            email: 'technico@batiment-pro.fr',
            password: 'Technico@2026!',
          },
        ],
        stats: {
          categories: categorieCount,
          sousCategories: sousCategorieCount,
          prestations: prestationCount,
          materiaux: materiauCount,
          servicesMainOeuvre: serviceMOCount,
          fournisseurs: fournisseurCount,
          clients: clientCount,
          demandesDevis: demandeCount,
          prestationsCompositions: compositionCount,
          choixOptionsCompositions: choixCompositionCount,
          devis: devisCount,
          lignesDevis: ligneDevisCount,
        },
      };
    } catch (error) {
      this.logger.error('Seed failed:', error);
      throw error;
    }
  }
}
