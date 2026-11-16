import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import * as bcrypt from 'bcrypt';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Seeding de la base de données...\n');

  // 1. Créer l'entreprise par défaut
  const company = await prisma.company.upsert({
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
  console.log(`✅ Entreprise créée : ${company.nom} (ID: ${company.id})`);

  // 2. Créer le compte Admin initial
  const adminPassword = await bcrypt.hash('Admin@2026!', 12);
  const admin = await prisma.user.upsert({
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
      mustChangePassword: false, // L'admin initial n'a pas besoin de changer
    },
  });
  console.log(`✅ Admin créé : ${admin.email} (ID: ${admin.id})`);
  console.log(`   Mot de passe : Admin@2026!`);

  // 2b. Créer le compte Technico-Commercial
  const technicoPassword = await bcrypt.hash('Technico@2026!', 12);
  const technico = await prisma.user.upsert({
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
  console.log(`✅ Technico créé : ${technico.email} (ID: ${technico.id})`);
  console.log(`   Mot de passe : Technico@2026!`);

  // 2b-bis. Créer le compte Assistante Administrative
  const assistantePassword = await bcrypt.hash('Assistante@2026!', 12);
  const assistante = await prisma.user.upsert({
    where: { email: 'assistante@batiment-pro.fr' },
    update: {},
    create: {
      companyId: company.id,
      nom: 'Martin',
      prenom: 'Sophie',
      email: 'assistante@batiment-pro.fr',
      password: assistantePassword,
      role: 'ASSISTANTE',
      telephone: '0612345678',
      actif: true,
      mustChangePassword: false,
    },
  });
  console.log(`✅ Assistante créée : ${assistante.email} (ID: ${assistante.id})`);
  console.log(`   Mot de passe : Assistante@2026!`);

  // 2b-ter. Créer le compte Chef de Chantier
  const chefPassword = await bcrypt.hash('Chef@2026!', 12);
  const chef = await prisma.user.upsert({
    where: { email: 'chef@batiment-pro.fr' },
    update: {},
    create: {
      companyId: company.id,
      nom: 'Leroy',
      prenom: 'Jean',
      email: 'chef@batiment-pro.fr',
      password: chefPassword,
      role: 'CHEF_CHANTIER',
      telephone: '0622334455',
      actif: true,
      mustChangePassword: false,
    },
  });
  console.log(`✅ Chef de chantier créé : ${chef.email} (ID: ${chef.id})`);
  console.log(`   Mot de passe : Chef@2026!`);

  // 2b-quater. Créer le compte Sous-traitant
  const sousTraitantUserPassword = await bcrypt.hash('Soustraitant@2026!', 12);
  const sousTraitantUser = await prisma.user.upsert({
    where: { email: 'soustraitant@batiment-pro.fr' },
    update: {},
    create: {
      companyId: company.id,
      nom: 'Bernard',
      prenom: 'Pierre',
      email: 'soustraitant@batiment-pro.fr',
      password: sousTraitantUserPassword,
      role: 'SOUS_TRAITANT',
      telephone: '0655667788',
      actif: true,
      mustChangePassword: false,
    },
  });
  console.log(`✅ Sous-traitant créé : ${sousTraitantUser.email} (ID: ${sousTraitantUser.id})`);
  console.log(`   Mot de passe : Soustraitant@2026!`);

  // 2c. Créer les types de projet (gérés par Admin)
  const typesProjetData = [
    { nom: 'Rénovation salle de bain', description: 'Travaux de rénovation complète ou partielle de salle de bain' },
    { nom: 'Rénovation cuisine', description: 'Travaux de rénovation de cuisine' },
    { nom: 'Rénovation appartement', description: 'Rénovation complète d\'un appartement' },
    { nom: 'Rénovation maison', description: 'Rénovation complète d\'une maison' },
    { nom: 'Construction neuve', description: 'Construction d\'un bâtiment neuf' },
    { nom: 'Extension / Surélévation', description: 'Extension ou surélévation de bâtiment existant' },
    { nom: 'Carrelage / Faïence', description: 'Pose de carrelage sol et mur' },
    { nom: 'Peinture / Décoration', description: 'Travaux de peinture intérieure et extérieure' },
    { nom: 'Plomberie / Sanitaire', description: 'Installation et réparation plomberie' },
    { nom: 'Électricité', description: 'Installation et mise aux normes électriques' },
    { nom: 'Maçonnerie / Gros œuvre', description: 'Travaux de maçonnerie et structure' },
    { nom: 'Isolation / Plâtrerie', description: 'Isolation thermique et phonique, placo' },
    { nom: 'Menuiserie', description: 'Pose de portes, fenêtres, placards' },
    { nom: 'Revêtement de sol', description: 'Pose de parquet, vinyle, moquette' },
    { nom: 'Toiture / Couverture', description: 'Travaux de toiture et charpente' },
    { nom: 'Aménagement extérieur', description: 'Terrasse, clôture, aménagement jardin' },
    { nom: 'Démolition / Désamiantage', description: 'Travaux de démolition et dépose' },
  ];

  for (const tp of typesProjetData) {
    await prisma.typeProjet.upsert({
      where: { companyId_nom: { companyId: company.id, nom: tp.nom } },
      update: {},
      create: { ...tp, companyId: company.id },
    });
  }
  console.log(`✅ ${typesProjetData.length} types de projet créés`);

  // ═══════════════════════════════════════════════════════════════
  // 3. CATALOGUE COMPLET : Catégories → Sous-catégories → Prestations → Options → Choix
  // ═══════════════════════════════════════════════════════════════

  const catalogue = [
    // ── 1. DÉMOLITION ──
    {
      categorie: 'Démolition',
      description: 'Travaux de démolition, dépose et évacuation',
      sousCategories: [
        {
          nom: 'Cloisons',
          description: 'Démolition de cloisons',
          prestations: [
            {
              nom: 'Démolition cloison', unite: 'M2', prixVenteMin: 15, prixVenteMax: 35,
              description: 'Démolition de cloison non porteuse + évacuation gravats',
              options: [
                { nom: 'Type de cloison', obligatoire: true, choix: [
                  { nom: 'Cloison en plâtre', impactPrix: 0 },
                  { nom: 'Cloison en brique creuse', impactPrix: 5 },
                  { nom: 'Cloison en plaques de plâtre', impactPrix: 3 },
                  { nom: 'Cloison en béton cellulaire', impactPrix: 8 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'Sols',
          description: 'Dépose de revêtements de sol',
          prestations: [
            {
              nom: 'Dépose revêtement sol', unite: 'M2', prixVenteMin: 10, prixVenteMax: 25,
              description: 'Dépose de revêtement de sol existant + évacuation',
              options: [
                { nom: 'Type de revêtement', obligatoire: true, choix: [
                  { nom: 'Carrelage', impactPrix: 0 },
                  { nom: 'Parquet collé', impactPrix: 8 },
                  { nom: 'Parquet flottant', impactPrix: 5 },
                  { nom: 'Moquette', impactPrix: 2 },
                  { nom: 'Vinyle / PVC', impactPrix: 1 },
                  { nom: 'Lino', impactPrix: 0 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'Sanitaires',
          description: 'Dépose d\'équipements sanitaires',
          prestations: [
            {
              nom: 'Dépose sanitaires', unite: 'PIECE', prixVenteMin: 50, prixVenteMax: 200,
              description: 'Dépose d\'un équipement sanitaire',
              options: [
                { nom: 'Type d\'équipement', obligatoire: true, choix: [
                  { nom: 'Baignoire', impactPrix: 0 },
                  { nom: 'Douche / receveur', impactPrix: 15 },
                  { nom: 'WC', impactPrix: 5 },
                  { nom: 'Lavabo / vasque', impactPrix: 8 },
                  { nom: 'Bidet', impactPrix: 20 },
                  { nom: 'Meuble vasque', impactPrix: 25 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'Murs',
          description: 'Démolition d\'éléments muraux',
          prestations: [
            {
              nom: 'Démolition murale partielle', unite: 'M2', prixVenteMin: 25, prixVenteMax: 60,
              description: 'Démolition partielle de mur avec protection zones adjacentes',
              options: [
                { nom: 'Type de mur', obligatoire: true, choix: [
                  { nom: 'Brique', impactPrix: 0 },
                  { nom: 'Béton', impactPrix: 5 },
                  { nom: 'Pierre', impactPrix: 10 },
                  { nom: 'Parpaing', impactPrix: 2 }
                ]},
              ],
            },
            {
              nom: 'Dépose carrelage mural', unite: 'M2', prixVenteMin: 12, prixVenteMax: 25,
              description: 'Dépose de carrelage ou faïence murale',
              options: [],
            },
          ],
        },
      ],
    },

    // ── 2. MAÇONNERIE / GROS ŒUVRE ──
    {
      categorie: 'Maçonnerie',
      description: 'Gros œuvre, ouvertures, cloisons, chapes',
      sousCategories: [
        {
          nom: 'Ouvertures',
          description: 'Création et modification d\'ouvertures',
          prestations: [
            {
              nom: 'Ouverture mur porteur', unite: 'FORFAIT', prixVenteMin: 1500, prixVenteMax: 3500,
              description: 'Ouverture dans un mur porteur avec pose IPN',
              options: [
                { nom: 'Type de mur', obligatoire: true, choix: [
                  { nom: 'Béton armé', impactPrix: 300 },
                  { nom: 'Brique pleine', impactPrix: 150 },
                  { nom: 'Pierre', impactPrix: 400 },
                  { nom: 'Parpaing', impactPrix: 100 }
                ]},
                { nom: 'Largeur ouverture', obligatoire: true, choix: [
                  { nom: '< 1m', impactPrix: 0 },
                  { nom: '1m à 2m', impactPrix: 400 },
                  { nom: '2m à 3m', impactPrix: 800 },
                  { nom: '> 3m', impactPrix: 1200 }
                ]},
              ],
            },
            {
              nom: 'Création ouverture fenêtre', unite: 'FORFAIT', prixVenteMin: 800, prixVenteMax: 1800,
              description: 'Création d\'une ouverture pour fenêtre dans mur existant',
              options: [
                { nom: 'Type de mur', obligatoire: true, choix: ['Brique', 'Parpaing', 'Pierre'] },
              ],
            },
          ],
        },
        {
          nom: 'Cloisons',
          description: 'Montage de cloisons',
          prestations: [
            {
              nom: 'Montage cloison placo', unite: 'M2', prixVenteMin: 35, prixVenteMax: 60,
              description: 'Montage cloison en plaque de plâtre sur rail',
              options: [
                { nom: 'Type de placo', obligatoire: true, choix: [
                  { nom: 'BA13 standard', impactPrix: 0 },
                  { nom: 'BA13 hydrofuge', impactPrix: 12 },
                  { nom: 'BA13 phonique', impactPrix: 20 },
                  { nom: 'BA13 feu (rose)', impactPrix: 15 },
                  { nom: 'Double parement', impactPrix: 35 }
                ]},
                { nom: 'Isolation intégrée', obligatoire: false, choix: [
                  { nom: 'Sans isolation', impactPrix: 0 },
                  { nom: 'Laine de verre 45mm', impactPrix: 15 },
                  { nom: 'Laine de verre 70mm', impactPrix: 25 },
                  { nom: 'Laine de roche 45mm', impactPrix: 20 }
                ]},
              ],
            },
            {
              nom: 'Montage cloison briques', unite: 'M2', prixVenteMin: 40, prixVenteMax: 70,
              description: 'Montage cloison en briques plâtrières',
              options: [
                { nom: 'Épaisseur', obligatoire: true, choix: [
                  { nom: '5cm', impactPrix: 0 },
                  { nom: '7cm', impactPrix: 8 },
                  { nom: '10cm', impactPrix: 15 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'Chapes',
          description: 'Réalisation de chapes',
          prestations: [
            {
              nom: 'Chape béton', unite: 'M2', prixVenteMin: 20, prixVenteMax: 45,
              description: 'Réalisation d\'une chape béton',
              options: [
                { nom: 'Type de chape', obligatoire: true, choix: [
                  { nom: 'Chape traditionnelle', impactPrix: 0 },
                  { nom: 'Chape allégée', impactPrix: 20 },
                  { nom: 'Chape fibrée', impactPrix: 15 },
                  { nom: 'Chape liquide anhydrite', impactPrix: 35 }
                ]},
                { nom: 'Épaisseur', obligatoire: true, choix: [
                  { nom: '3-4 cm', impactPrix: 0 },
                  { nom: '5-6 cm', impactPrix: 10 },
                  { nom: '7-8 cm', impactPrix: 20 },
                  { nom: '> 8 cm', impactPrix: 30 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'Murs',
          description: 'Construction de murs',
          prestations: [
            {
              nom: 'Montage mur agglo', unite: 'M2', prixVenteMin: 45, prixVenteMax: 80,
              description: 'Construction de mur en agglo / parpaing',
              options: [
                { nom: 'Type d\'agglo', obligatoire: true, choix: [
                  { nom: 'Creux 20cm', impactPrix: 0 },
                  { nom: 'Creux 15cm', impactPrix: 5 },
                  { nom: 'Plein 20cm', impactPrix: 15 },
                  { nom: 'Plein 15cm', impactPrix: 10 },
                  { nom: 'Béton cellulaire', impactPrix: 25 }
                ]},
              ],
            },
          ],
        },
      ],
    },

    // ── 3. PLÂTRERIE / FAUX PLAFOND ──
    {
      categorie: 'Plâtrerie',
      description: 'Plâtrerie, faux plafonds, doublage',
      sousCategories: [
        {
          nom: 'Faux plafonds',
          description: 'Réalisation de faux plafonds',
          prestations: [
            {
              nom: 'Faux plafond placo', unite: 'M2', prixVenteMin: 35, prixVenteMax: 65,
              description: 'Pose de faux plafond en plaques de plâtre sur ossature métallique',
              options: [
                { nom: 'Type de plaque', obligatoire: true, choix: [
                  { nom: 'BA13 standard', impactPrix: 0 },
                  { nom: 'BA13 hydrofuge', impactPrix: 10 },
                  { nom: 'Acoustique haute performance', impactPrix: 25 },
                  { nom: 'Feu M1', impactPrix: 15 }
                ]},
                { nom: 'Hauteur sous plafond perdue', obligatoire: false, choix: [
                  { nom: '5-10 cm', impactPrix: 0 },
                  { nom: '10-20 cm', impactPrix: 3 },
                  { nom: '20-40 cm', impactPrix: 8 },
                  { nom: '> 40 cm', impactPrix: 12 }
                ]},
              ],
            },
            {
              nom: 'Faux plafond dalles', unite: 'M2', prixVenteMin: 25, prixVenteMax: 50,
              description: 'Pose de faux plafond en dalles sur ossature apparente',
              options: [
                { nom: 'Type de dalle', obligatoire: true, choix: [
                  { nom: 'Minérale standard', impactPrix: 0 },
                  { nom: 'Minérale acoustique', impactPrix: 8 },
                  { nom: 'Métallique', impactPrix: 20 },
                  { nom: 'PVC', impactPrix: 5 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'Doublage',
          description: 'Doublage de murs',
          prestations: [
            {
              nom: 'Doublage mur', unite: 'M2', prixVenteMin: 30, prixVenteMax: 55,
              description: 'Doublage isolant collé ou sur ossature',
              options: [
                { nom: 'Type d\'isolant', obligatoire: true, choix: [
                  { nom: 'Polystyrène expansé (PSE)', impactPrix: 0 },
                  { nom: 'Polystyrène extrudé (XPS)', impactPrix: 50 },
                  { nom: 'Laine de verre', impactPrix: 10 },
                  { nom: 'Laine de roche', impactPrix: 20 }
                ]},
                { nom: 'Épaisseur isolant', obligatoire: true, choix: [
                  { nom: '40mm', impactPrix: 0 },
                  { nom: '60mm', impactPrix: 15 },
                  { nom: '80mm', impactPrix: 30 },
                  { nom: '100mm', impactPrix: 45 },
                  { nom: '120mm', impactPrix: 60 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'Enduits',
          description: 'Travaux d\'enduits intérieurs',
          prestations: [
            {
              nom: 'Enduit plâtre mur', unite: 'M2', prixVenteMin: 18, prixVenteMax: 35,
              description: 'Application enduit plâtre sur mur',
              options: [
                { nom: 'Finition', obligatoire: true, choix: [
                  { nom: 'Lissé', impactPrix: 0 },
                  { nom: 'Taloché', impactPrix: 3 },
                  { nom: 'Projeté', impactPrix: 2 }
                ]},
              ],
            },
            {
              nom: 'Bandes à joints', unite: 'ML', prixVenteMin: 5, prixVenteMax: 12,
              description: 'Réalisation de bandes à joints sur plaques de plâtre',
              options: [],
            },
          ],
        },
      ],
    },

    // ── 4. ISOLATION ──
    {
      categorie: 'Isolation',
      description: 'Isolation thermique et phonique',
      sousCategories: [
        {
          nom: 'Murs',
          description: 'Isolation des murs',
          prestations: [
            {
              nom: 'Isolation mur intérieur', unite: 'M2', prixVenteMin: 30, prixVenteMax: 65,
              description: 'Isolation thermique mur intérieur (isolant + placo)',
              options: [
                { nom: 'Type d\'isolant', obligatoire: true, choix: [
                  { nom: 'Laine de verre', impactPrix: 0 },
                  { nom: 'Laine de roche', impactPrix: 20 },
                  { nom: 'Polystyrène expansé', impactPrix: 5 },
                  { nom: 'Polyuréthane', impactPrix: 80 },
                  { nom: 'Fibre de bois', impactPrix: 40 }
                ]},
                { nom: 'Épaisseur', obligatoire: true, choix: [
                  { nom: '60mm (R=1.85)', impactPrix: 0 },
                  { nom: '80mm (R=2.50)', impactPrix: 20 },
                  { nom: '100mm (R=3.15)', impactPrix: 40 },
                  { nom: '120mm (R=3.75)', impactPrix: 60 },
                  { nom: '140mm (R=4.35)', impactPrix: 80 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'Combles',
          description: 'Isolation des combles',
          prestations: [
            {
              nom: 'Isolation combles soufflage', unite: 'M2', prixVenteMin: 18, prixVenteMax: 40,
              description: 'Isolation des combles perdus par soufflage',
              options: [
                { nom: 'Type d\'isolant', obligatoire: true, choix: [
                  { nom: 'Laine de verre', impactPrix: 0 },
                  { nom: 'Laine de roche', impactPrix: 8 },
                  { nom: 'Ouate de cellulose', impactPrix: 15 },
                  { nom: 'Fibre de bois', impactPrix: 20 }
                ]},
                { nom: 'Résistance thermique', obligatoire: true, choix: [
                  { nom: 'R=7 (30cm)', impactPrix: 0 },
                  { nom: 'R=8 (35cm)', impactPrix: 5 },
                  { nom: 'R=10 (40cm)', impactPrix: 10 }
                ]},
              ],
            },
            {
              nom: 'Isolation combles rampants', unite: 'M2', prixVenteMin: 35, prixVenteMax: 65,
              description: 'Isolation sous rampants de toiture',
              options: [
                { nom: 'Type d\'isolant', obligatoire: true, choix: [
                  { nom: 'Laine de verre', impactPrix: 0 },
                  { nom: 'Laine de roche', impactPrix: 12 },
                  { nom: 'Fibre de bois', impactPrix: 25 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'Sols',
          description: 'Isolation des sols',
          prestations: [
            {
              nom: 'Isolation sol', unite: 'M2', prixVenteMin: 25, prixVenteMax: 50,
              description: 'Isolation thermique du sol',
              options: [
                { nom: 'Type d\'isolant', obligatoire: true, choix: [
                  { nom: 'Polystyrène extrudé (XPS)', impactPrix: 30 },
                  { nom: 'Polyuréthane', impactPrix: 60 },
                  { nom: 'Laine de roche haute densité', impactPrix: 20 }
                ]},
                { nom: 'Épaisseur', obligatoire: true, choix: [
                  { nom: '40mm', impactPrix: 0 },
                  { nom: '60mm', impactPrix: 15 },
                  { nom: '80mm', impactPrix: 30 },
                  { nom: '100mm', impactPrix: 45 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'Phonique',
          description: 'Isolation acoustique',
          prestations: [
            {
              nom: 'Isolation phonique', unite: 'M2', prixVenteMin: 40, prixVenteMax: 80,
              description: 'Isolation acoustique mur ou plafond',
              options: [
                { nom: 'Support', obligatoire: true, choix: [
                  { nom: 'Mur', impactPrix: 0 },
                  { nom: 'Plafond', impactPrix: 10 },
                  { nom: 'Cloison', impactPrix: 5 }
                ]},
                { nom: 'Type d\'isolant', obligatoire: true, choix: [
                  { nom: 'Laine de roche', impactPrix: 0 },
                  { nom: 'Mousse acoustique', impactPrix: 15 },
                  { nom: 'Placo phonique + laine', impactPrix: 25 },
                  { nom: 'Membrane acoustique', impactPrix: 20 }
                ]},
              ],
            },
          ],
        },
      ],
    },

    // ── 5. PLOMBERIE / SANITAIRE ──
    {
      categorie: 'Plomberie',
      description: 'Installation et réparation plomberie / sanitaire',
      sousCategories: [
        {
          nom: 'Douche',
          description: 'Installation et remplacement de douche',
          prestations: [
            {
              nom: 'Installation douche complète', unite: 'FORFAIT', prixVenteMin: 800, prixVenteMax: 2000,
              description: 'Installation complète d\'une douche (receveur, robinetterie, raccordements)',
              options: [
                { nom: 'Type de douche', obligatoire: true, choix: [
                  { nom: 'Douche italienne', impactPrix: 500 },
                  { nom: 'Receveur extra-plat', impactPrix: 0 },
                  { nom: 'Receveur surélevé', impactPrix: 150 },
                  { nom: 'Cabine de douche complète', impactPrix: 400 }
                ]},
                { nom: 'Paroi', obligatoire: false, choix: [
                  { nom: 'Sans paroi', impactPrix: 0 },
                  { nom: 'Paroi fixe', impactPrix: 100 },
                  { nom: 'Paroi battante', impactPrix: 150 },
                  { nom: 'Paroi coulissante', impactPrix: 200 },
                  { nom: 'Rideau de douche', impactPrix: 30 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'WC',
          description: 'Installation et remplacement de WC',
          prestations: [
            {
              nom: 'Remplacement WC', unite: 'PIECE', prixVenteMin: 350, prixVenteMax: 800,
              description: 'Dépose ancien WC + pose nouveau WC',
              options: [
                { nom: 'Type de WC', obligatoire: true, choix: [
                  { nom: 'WC posé classique', impactPrix: 0 },
                  { nom: 'WC suspendu', impactPrix: 200 },
                  { nom: 'WC broyeur', impactPrix: 500 },
                  { nom: 'WC lavant', impactPrix: 800 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'Lavabo',
          description: 'Installation de lavabos et vasques',
          prestations: [
            {
              nom: 'Installation lavabo', unite: 'PIECE', prixVenteMin: 300, prixVenteMax: 600,
              description: 'Pose d\'un lavabo avec robinetterie et raccordement',
              options: [
                { nom: 'Type de vasque', obligatoire: true, choix: [
                  { nom: 'Vasque à poser', impactPrix: 0 },
                  { nom: 'Vasque encastrée', impactPrix: 50 },
                  { nom: 'Lavabo suspendu', impactPrix: 30 },
                  { nom: 'Lave-mains', impactPrix: 10 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'Baignoire',
          description: 'Installation de baignoires',
          prestations: [
            {
              nom: 'Pose baignoire', unite: 'FORFAIT', prixVenteMin: 600, prixVenteMax: 1500,
              description: 'Pose de baignoire avec tablier et raccordement',
              options: [
                { nom: 'Type de baignoire', obligatoire: true, choix: [
                  { nom: 'Baignoire standard', impactPrix: 0 },
                  { nom: 'Baignoire balnéo', impactPrix: 300 },
                  { nom: 'Baignoire îlot', impactPrix: 600 },
                  { nom: 'Baignoire d\'angle', impactPrix: 400 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'Chauffe-eau',
          description: 'Installation de chauffe-eau',
          prestations: [
            {
              nom: 'Remplacement chauffe-eau', unite: 'FORFAIT', prixVenteMin: 600, prixVenteMax: 1500,
              description: 'Dépose + pose chauffe-eau',
              options: [
                { nom: 'Type de chauffe-eau', obligatoire: true, choix: [
                  { nom: 'Électrique (cumulus)', impactPrix: 0 },
                  { nom: 'Gaz', impactPrix: 200 },
                  { nom: 'Thermodynamique', impactPrix: 800 },
                  { nom: 'Solaire', impactPrix: 1500 }
                ]},
                { nom: 'Capacité', obligatoire: true, choix: [
                  { nom: '100L', impactPrix: 0 },
                  { nom: '150L', impactPrix: 150 },
                  { nom: '200L', impactPrix: 300 },
                  { nom: '300L', impactPrix: 500 }
                ]},
              ],
            },
          ],
        },
        {
          nom: 'Tuyauterie',
          description: 'Remplacement et création de réseaux',
          prestations: [
            {
              nom: 'Remplacement tuyauterie', unite: 'ML', prixVenteMin: 25, prixVenteMax: 60,
              description: 'Remplacement de tuyauterie eau chaude/froide',
              options: [
                { nom: 'Type de tuyau', obligatoire: true, choix: ['PER', 'Cuivre', 'Multicouche'] },
                { nom: 'Diamètre', obligatoire: true, choix: ['12mm', '16mm', '20mm', '25mm'] },
              ],
            },
            {
              nom: 'Création point d\'eau', unite: 'FORFAIT', prixVenteMin: 250, prixVenteMax: 600,
              description: 'Création d\'un nouveau point d\'eau (alimentation + évacuation)',
              options: [],
            },
          ],
        },
      ],
    },

    // ── 6. ÉLECTRICITÉ ──
    {
      categorie: 'Électricité',
      description: 'Travaux électriques et mise aux normes',
      sousCategories: [
        {
          nom: 'Prises et interrupteurs',
          description: 'Installation de prises et interrupteurs',
          prestations: [
            {
              nom: 'Pose prise électrique', unite: 'PIECE', prixVenteMin: 45, prixVenteMax: 90,
              description: 'Pose d\'une prise électrique avec saignée et raccordement',
              options: [
                { nom: 'Type de prise', obligatoire: true, choix: ['Prise simple 2P+T', 'Prise double', 'Prise USB', 'Prise étanche (IP44)', 'Prise spécialisée 32A'] },
              ],
            },
            {
              nom: 'Pose interrupteur', unite: 'PIECE', prixVenteMin: 40, prixVenteMax: 75,
              description: 'Pose d\'un interrupteur',
              options: [
                { nom: 'Type d\'interrupteur', obligatoire: true, choix: ['Simple allumage', 'Va-et-vient', 'Double allumage', 'Variateur', 'Bouton poussoir'] },
              ],
            },
          ],
        },
        {
          nom: 'Éclairage',
          description: 'Installation d\'éclairages',
          prestations: [
            {
              nom: 'Pose luminaire', unite: 'PIECE', prixVenteMin: 50, prixVenteMax: 120,
              description: 'Pose d\'un luminaire avec raccordement',
              options: [
                { nom: 'Type de luminaire', obligatoire: true, choix: ['Spot encastré LED', 'Suspension', 'Applique murale', 'Plafonnier', 'Bandeau LED', 'Réglette LED'] },
              ],
            },
          ],
        },
        {
          nom: 'Tableau électrique',
          description: 'Tableau et mise aux normes',
          prestations: [
            {
              nom: 'Mise aux normes tableau', unite: 'FORFAIT', prixVenteMin: 800, prixVenteMax: 2500,
              description: 'Mise aux normes NF C 15-100 du tableau électrique',
              options: [
                { nom: 'Type d\'installation', obligatoire: true, choix: ['Monophasé standard', 'Monophasé renforcé', 'Triphasé'] },
                { nom: 'Nombre de circuits', obligatoire: false, choix: ['< 10 circuits', '10 à 20 circuits', '> 20 circuits'] },
              ],
            },
            {
              nom: 'Remplacement tableau', unite: 'FORFAIT', prixVenteMin: 500, prixVenteMax: 1500,
              description: 'Remplacement du tableau électrique vétuste',
              options: [
                { nom: 'Nombre de rangées', obligatoire: true, choix: ['1 rangée (13 modules)', '2 rangées (26 modules)', '3 rangées (39 modules)', '4 rangées (52 modules)'] },
              ],
            },
          ],
        },
        {
          nom: 'Domotique',
          description: 'Installations domotiques',
          prestations: [
            {
              nom: 'Installation domotique', unite: 'PIECE', prixVenteMin: 80, prixVenteMax: 250,
              description: 'Installation d\'un équipement domotique',
              options: [
                { nom: 'Type d\'équipement', obligatoire: true, choix: ['Interrupteur connecté', 'Thermostat connecté', 'Volets roulants connectés', 'Prise connectée', 'Détecteur de mouvement'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 7. CARRELAGE / FAÏENCE ──
    {
      categorie: 'Carrelage',
      description: 'Pose et fourniture de carrelage (sol et mur)',
      sousCategories: [
        {
          nom: 'Sol',
          description: 'Carrelage au sol',
          prestations: [
            {
              nom: 'Pose carrelage sol', unite: 'M2', prixVenteMin: 30, prixVenteMax: 65,
              description: 'Pose de carrelage au sol',
              options: [
                {
                  nom: 'Format',
                  obligatoire: true,
                  choix: [
                    { nom: '20x20 cm', impactPrix: 0 },
                    { nom: '30x30 cm', impactPrix: 0 },
                    { nom: '45x45 cm', impactPrix: 0 },
                    { nom: '60x60 cm', impactPrix: 0 },
                    { nom: '30x60 cm', impactPrix: 0 },
                    { nom: '120x60 cm', impactPrix: 0 },
                    { nom: '120x120 cm', impactPrix: 0 },
                  ],
                },
                {
                  nom: 'Type de pose',
                  obligatoire: true,
                  choix: [
                    { nom: 'Pose droite', impactPrix: 0 },
                    { nom: 'Pose diagonale', impactPrix: 4.5 },
                    { nom: 'Pose décalée 1/3', impactPrix: 2.8 },
                    { nom: 'Pose en chevron', impactPrix: 8.5 },
                    { nom: 'Pose cabochon', impactPrix: 10.0 },
                  ],
                },
                {
                  nom: 'Type de colle',
                  obligatoire: false,
                  choix: [
                    { nom: 'Colle C1 (intérieur)', impactPrix: -2.0 },
                    { nom: 'Colle C2 (renforcée)', impactPrix: 0 },
                    { nom: 'Colle C2S1 (déformable)', impactPrix: 2.2 },
                    { nom: 'Colle C2S2 (grands formats)', impactPrix: 4.8 },
                  ],
                },
              ],
            },
          ],
        },
        {
          nom: 'Mural',
          description: 'Carrelage mural',
          prestations: [
            {
              nom: 'Pose carrelage mural', unite: 'M2', prixVenteMin: 35, prixVenteMax: 70,
              description: 'Pose de carrelage mural',
              options: [
                {
                  nom: 'Format',
                  obligatoire: true,
                  choix: [
                    { nom: '10x10 cm', impactPrix: 0 },
                    { nom: '10x20 cm (métro)', impactPrix: 0 },
                    { nom: '20x20 cm', impactPrix: 0 },
                    { nom: '30x60 cm', impactPrix: 0 },
                    { nom: '25x75 cm', impactPrix: 0 },
                    { nom: 'Grand format > 60cm', impactPrix: 0 },
                  ],
                },
                {
                  nom: 'Pièce',
                  obligatoire: false,
                  choix: [
                    { nom: 'Salle de bain', impactPrix: 0 },
                    { nom: 'Cuisine (crédence)', impactPrix: 2.5 },
                    { nom: 'WC', impactPrix: 1.2 },
                    { nom: 'Autre', impactPrix: 0 },
                  ],
                },
              ],
            },
          ],
        },
        {
          nom: 'Faïence',
          description: 'Pose de faïence décorative',
          prestations: [
            {
              nom: 'Pose faïence', unite: 'M2', prixVenteMin: 40, prixVenteMax: 75,
              description: 'Pose de faïence murale décorative',
              options: [
                {
                  nom: 'Type',
                  obligatoire: true,
                  choix: [
                    { nom: 'Faïence classique', impactPrix: 0 },
                    { nom: 'Carreaux métro', impactPrix: 0 },
                    { nom: 'Zellige', impactPrix: 0 },
                    { nom: 'Mosaïque', impactPrix: 0 },
                    { nom: 'Carreaux de ciment', impactPrix: 0 },
                  ],
                },
              ],
            },
          ],
        },
        {
          nom: 'Préparation',
          description: 'Préparation des supports avant pose',
          prestations: [
            {
              nom: 'Ragréage sol', unite: 'M2', prixVenteMin: 12, prixVenteMax: 28,
              description: 'Ragréage et préparation du sol avant pose',
              options: [
                {
                  nom: 'Type de ragréage',
                  obligatoire: true,
                  choix: [
                    { nom: 'Autolissant standard (P3)', impactPrix: 0 },
                    { nom: 'Autolissant renforcé (P4)', impactPrix: 0 },
                    { nom: 'Fibré haute résistance', impactPrix: 0 },
                  ],
                },
                {
                  nom: 'Épaisseur',
                  obligatoire: false,
                  choix: [
                    { nom: '1-3 mm', impactPrix: 0 },
                    { nom: '3-10 mm', impactPrix: 5.5 },
                    { nom: '10-30 mm', impactPrix: 12.0 },
                  ],
                },
              ],
            },
            {
              nom: 'Primaire d\'accrochage', unite: 'M2', prixVenteMin: 3, prixVenteMax: 8,
              description: 'Application primaire d\'accrochage avant ragréage ou colle',
              options: [],
            },
          ],
        },
      ],
    },

    // ── 8. PEINTURE ──
    {
      categorie: 'Peinture',
      description: 'Travaux de peinture intérieure et extérieure',
      sousCategories: [
        {
          nom: 'Murs intérieurs',
          description: 'Peinture murale intérieure',
          prestations: [
            {
              nom: 'Peinture mur intérieur', unite: 'M2', prixVenteMin: 14, prixVenteMax: 28,
              description: 'Peinture murale intérieure (2 couches)',
              options: [
                { nom: 'Finition', obligatoire: true, choix: ['Mat', 'Satin', 'Velours', 'Brillant'] },
                { nom: 'Type de peinture', obligatoire: false, choix: ['Acrylique', 'Glycéro', 'Alkyde', 'Bio-sourcée'] },
              ],
            },
          ],
        },
        {
          nom: 'Plafonds',
          description: 'Peinture de plafonds',
          prestations: [
            {
              nom: 'Peinture plafond', unite: 'M2', prixVenteMin: 16, prixVenteMax: 32,
              description: 'Peinture plafond (2 couches)',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Acrylique mat', 'Glycéro', 'Anti-humidité', 'Anti-moisissure'] },
              ],
            },
          ],
        },
        {
          nom: 'Extérieur',
          description: 'Peinture extérieure',
          prestations: [
            {
              nom: 'Peinture extérieure façade', unite: 'M2', prixVenteMin: 22, prixVenteMax: 48,
              description: 'Peinture extérieure sur façade',
              options: [
                { nom: 'Type de peinture', obligatoire: true, choix: ['Acrylique', 'Siloxane', 'Pliolite', 'Hydropliolite'] },
              ],
            },
          ],
        },
        {
          nom: 'Boiseries',
          description: 'Peinture sur bois',
          prestations: [
            {
              nom: 'Peinture boiseries', unite: 'ML', prixVenteMin: 10, prixVenteMax: 25,
              description: 'Peinture sur boiseries (portes, plinthes, fenêtres)',
              options: [
                { nom: 'Finition', obligatoire: true, choix: ['Laque brillante', 'Laque satinée', 'Mat', 'Vernis'] },
              ],
            },
          ],
        },
        {
          nom: 'Enduits décoratifs',
          description: 'Application d\'enduits décoratifs',
          prestations: [
            {
              nom: 'Enduit décoratif', unite: 'M2', prixVenteMin: 30, prixVenteMax: 70,
              description: 'Application d\'enduit décoratif',
              options: [
                { nom: 'Type d\'enduit', obligatoire: true, choix: ['Stuc vénitien', 'Tadelakt', 'Béton ciré', 'Enduit à la chaux', 'Enduit texturé'] },
              ],
            },
          ],
        },
        {
          nom: 'Préparation',
          description: 'Préparation des murs avant peinture',
          prestations: [
            {
              nom: 'Préparation murs', unite: 'M2', prixVenteMin: 8, prixVenteMax: 18,
              description: 'Lessivage, rebouchage, ponçage, sous-couche',
              options: [
                { nom: 'État du support', obligatoire: true, choix: ['Bon état (lessivage)', 'Fissures légères (rebouchage)', 'Mauvais état (enduit complet)', 'Décollement (décapage)'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 9. REVÊTEMENT DE SOL ──
    {
      categorie: 'Revêtement de sol',
      description: 'Parquet, vinyle, moquette, résine',
      sousCategories: [
        {
          nom: 'Parquet flottant',
          description: 'Pose de parquet flottant / stratifié',
          prestations: [
            {
              nom: 'Pose parquet flottant', unite: 'M2', prixVenteMin: 22, prixVenteMax: 48,
              description: 'Pose de parquet flottant avec sous-couche',
              options: [
                { nom: 'Type de parquet', obligatoire: true, choix: ['Stratifié', 'Contrecollé chêne', 'Contrecollé noyer', 'PVC clipsable'] },
                { nom: 'Épaisseur', obligatoire: false, choix: ['7mm', '8mm', '10mm', '12mm', '14mm'] },
              ],
            },
          ],
        },
        {
          nom: 'Parquet massif',
          description: 'Pose de parquet massif',
          prestations: [
            {
              nom: 'Pose parquet massif', unite: 'M2', prixVenteMin: 45, prixVenteMax: 90,
              description: 'Pose de parquet massif collé ou cloué',
              options: [
                { nom: 'Essence', obligatoire: true, choix: ['Chêne', 'Hêtre', 'Noyer', 'Bambou', 'Teck', 'Wengé'] },
                { nom: 'Type de pose', obligatoire: true, choix: ['Collé', 'Cloué', 'Pose à l\'anglaise', 'Pose en point de Hongrie', 'Pose en chevron'] },
              ],
            },
            {
              nom: 'Ponçage vitrification parquet', unite: 'M2', prixVenteMin: 20, prixVenteMax: 40,
              description: 'Ponçage et vitrification de parquet existant',
              options: [
                { nom: 'Finition', obligatoire: true, choix: ['Vitrification mat', 'Vitrification satin', 'Vitrification brillant', 'Huilé', 'Ciré'] },
              ],
            },
          ],
        },
        {
          nom: 'Vinyle / PVC',
          description: 'Pose de revêtement vinyle',
          prestations: [
            {
              nom: 'Pose sol vinyle/PVC', unite: 'M2', prixVenteMin: 14, prixVenteMax: 32,
              description: 'Pose de revêtement vinyle ou PVC',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Lames clipsables', 'Dalles clipsables', 'Rouleau collé', 'Lames adhésives'] },
              ],
            },
          ],
        },
        {
          nom: 'Moquette',
          description: 'Pose de moquette',
          prestations: [
            {
              nom: 'Pose moquette', unite: 'M2', prixVenteMin: 12, prixVenteMax: 30,
              description: 'Pose de moquette',
              options: [
                { nom: 'Type de moquette', obligatoire: true, choix: ['Bouclée', 'Velours', 'Aiguilletée', 'Shaggy'] },
                { nom: 'Type de pose', obligatoire: true, choix: ['Collée', 'Tendue (thibaude)', 'Libre (pose flottante)'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 10. MENUISERIE INTÉRIEURE ──
    {
      categorie: 'Menuiserie intérieure',
      description: 'Portes, placards, escaliers',
      sousCategories: [
        {
          nom: 'Portes',
          description: 'Pose de portes intérieures',
          prestations: [
            {
              nom: 'Pose porte intérieure', unite: 'PIECE', prixVenteMin: 150, prixVenteMax: 350,
              description: 'Pose d\'une porte intérieure avec huisserie',
              options: [
                { nom: 'Type de porte', obligatoire: true, choix: ['Battante standard', 'Coulissante à galandage', 'Coulissante en applique', 'Pliante', 'Vitrée'] },
                { nom: 'Matériau', obligatoire: true, choix: ['Bois massif', 'MDF peint', 'MDF plaqué', 'Verre'] },
              ],
            },
          ],
        },
        {
          nom: 'Placards',
          description: 'Aménagement de placards',
          prestations: [
            {
              nom: 'Pose placard sur mesure', unite: 'ML', prixVenteMin: 300, prixVenteMax: 700,
              description: 'Fabrication et pose de placard sur mesure',
              options: [
                { nom: 'Type de portes', obligatoire: true, choix: ['Portes battantes', 'Portes coulissantes', 'Sans portes (dressing ouvert)'] },
                { nom: 'Aménagement intérieur', obligatoire: false, choix: ['Étagères simples', 'Étagères + penderie', 'Étagères + tiroirs + penderie', 'Sur mesure complet'] },
              ],
            },
          ],
        },
        {
          nom: 'Escaliers',
          description: 'Rénovation d\'escaliers',
          prestations: [
            {
              nom: 'Rénovation escalier', unite: 'FORFAIT', prixVenteMin: 1500, prixVenteMax: 5000,
              description: 'Rénovation complète d\'un escalier',
              options: [
                { nom: 'Matériau marches', obligatoire: true, choix: ['Bois massif', 'Bois stratifié', 'Béton ciré', 'Carrelage'] },
                { nom: 'Type de garde-corps', obligatoire: false, choix: ['Bois', 'Inox + câbles', 'Verre', 'Fer forgé'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 11. MENUISERIE EXTÉRIEURE ──
    {
      categorie: 'Menuiserie extérieure',
      description: 'Fenêtres, portes d\'entrée, volets, baies vitrées',
      sousCategories: [
        {
          nom: 'Fenêtres',
          description: 'Pose et remplacement de fenêtres',
          prestations: [
            {
              nom: 'Pose fenêtre', unite: 'PIECE', prixVenteMin: 250, prixVenteMax: 600,
              description: 'Dépose + pose fenêtre avec finitions',
              options: [
                { nom: 'Matériau', obligatoire: true, choix: ['PVC', 'Aluminium', 'Bois', 'Mixte bois-alu'] },
                { nom: 'Type d\'ouverture', obligatoire: true, choix: ['Battante (à la française)', 'Oscillo-battante', 'Coulissante', 'Fixe', 'Basculante'] },
                { nom: 'Vitrage', obligatoire: true, choix: ['Double vitrage standard', 'Double vitrage ITR', 'Triple vitrage', 'Vitrage phonique'] },
              ],
            },
          ],
        },
        {
          nom: 'Porte d\'entrée',
          description: 'Pose de portes d\'entrée',
          prestations: [
            {
              nom: 'Pose porte d\'entrée', unite: 'PIECE', prixVenteMin: 500, prixVenteMax: 2000,
              description: 'Dépose + pose porte d\'entrée',
              options: [
                { nom: 'Matériau', obligatoire: true, choix: ['PVC', 'Aluminium', 'Bois', 'Acier / blindée', 'Composite'] },
                { nom: 'Serrure', obligatoire: false, choix: ['3 points', '5 points', 'Serrure connectée'] },
              ],
            },
          ],
        },
        {
          nom: 'Volets',
          description: 'Pose de volets',
          prestations: [
            {
              nom: 'Pose volets', unite: 'PIECE', prixVenteMin: 200, prixVenteMax: 800,
              description: 'Pose de volets',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Volets roulants', 'Volets battants', 'Volets coulissants', 'Persiennes'] },
                { nom: 'Matériau', obligatoire: true, choix: ['PVC', 'Aluminium', 'Bois'] },
                { nom: 'Motorisation', obligatoire: false, choix: ['Manuel', 'Motorisé filaire', 'Motorisé radio', 'Motorisé solaire'] },
              ],
            },
          ],
        },
        {
          nom: 'Baies vitrées',
          description: 'Pose de baies vitrées',
          prestations: [
            {
              nom: 'Pose baie vitrée', unite: 'PIECE', prixVenteMin: 600, prixVenteMax: 2500,
              description: 'Dépose + pose baie vitrée',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Coulissante 2 vantaux', 'Coulissante 3 vantaux', 'À galandage', 'Battante'] },
                { nom: 'Matériau', obligatoire: true, choix: ['PVC', 'Aluminium', 'Mixte bois-alu'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 12. TOITURE / COUVERTURE ──
    {
      categorie: 'Toiture',
      description: 'Travaux de toiture, couverture et charpente',
      sousCategories: [
        {
          nom: 'Couverture',
          description: 'Réfection de couverture',
          prestations: [
            {
              nom: 'Réfection toiture complète', unite: 'M2', prixVenteMin: 80, prixVenteMax: 160,
              description: 'Dépose + repose couverture complète',
              options: [
                { nom: 'Matériau couverture', obligatoire: true, choix: ['Tuiles terre cuite', 'Tuiles béton', 'Ardoises naturelles', 'Ardoises synthétiques', 'Bac acier', 'Zinc'] },
              ],
            },
          ],
        },
        {
          nom: 'Réparation',
          description: 'Réparations ponctuelles',
          prestations: [
            {
              nom: 'Réparation toiture', unite: 'M2', prixVenteMin: 50, prixVenteMax: 110,
              description: 'Remplacement tuiles/ardoises, reprises ponctuelles',
              options: [
                { nom: 'Type de réparation', obligatoire: true, choix: ['Remplacement tuiles', 'Reprise étanchéité', 'Reprise faîtage', 'Reprise noue', 'Remplacement solin'] },
              ],
            },
          ],
        },
        {
          nom: 'Nettoyage',
          description: 'Nettoyage et traitement',
          prestations: [
            {
              nom: 'Nettoyage toiture', unite: 'M2', prixVenteMin: 10, prixVenteMax: 28,
              description: 'Nettoyage et traitement de toiture',
              options: [
                { nom: 'Méthode', obligatoire: true, choix: ['Haute pression', 'Brosse + mousse biocide', 'Traitement hydrofuge seul'] },
              ],
            },
          ],
        },
        {
          nom: 'Gouttières',
          description: 'Pose et remplacement de gouttières',
          prestations: [
            {
              nom: 'Remplacement gouttières', unite: 'ML', prixVenteMin: 20, prixVenteMax: 55,
              description: 'Dépose + pose de gouttières et descentes',
              options: [
                { nom: 'Matériau', obligatoire: true, choix: ['Zinc', 'PVC', 'Aluminium laqué', 'Cuivre'] },
                { nom: 'Forme', obligatoire: false, choix: ['Demi-ronde', 'Carrée', 'Havraise'] },
              ],
            },
          ],
        },
        {
          nom: 'Charpente',
          description: 'Traitement et réparation de charpente',
          prestations: [
            {
              nom: 'Traitement charpente', unite: 'M2', prixVenteMin: 15, prixVenteMax: 35,
              description: 'Traitement préventif ou curatif de charpente bois',
              options: [
                { nom: 'Type de traitement', obligatoire: true, choix: ['Préventif (injection)', 'Curatif (gel + injection)', 'Curatif + remplacement bois'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 13. FAÇADE / RAVALEMENT ──
    {
      categorie: 'Façade',
      description: 'Ravalement, enduit de façade, isolation extérieure',
      sousCategories: [
        {
          nom: 'Ravalement',
          description: 'Travaux de ravalement',
          prestations: [
            {
              nom: 'Ravalement façade', unite: 'M2', prixVenteMin: 40, prixVenteMax: 90,
              description: 'Ravalement complet de façade (nettoyage + enduit + peinture)',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Ravalement complet', 'Ravalement partiel', 'Simple nettoyage + peinture'] },
              ],
            },
          ],
        },
        {
          nom: 'Enduit',
          description: 'Application d\'enduit de façade',
          prestations: [
            {
              nom: 'Enduit façade', unite: 'M2', prixVenteMin: 30, prixVenteMax: 65,
              description: 'Application d\'enduit sur façade',
              options: [
                { nom: 'Type d\'enduit', obligatoire: true, choix: ['Monocouche taloché', 'Monocouche gratté', 'Traditionnel 3 couches', 'Enduit projeté'] },
              ],
            },
          ],
        },
        {
          nom: 'Nettoyage',
          description: 'Nettoyage de façade',
          prestations: [
            {
              nom: 'Nettoyage façade', unite: 'M2', prixVenteMin: 10, prixVenteMax: 30,
              description: 'Nettoyage de façade',
              options: [
                { nom: 'Méthode', obligatoire: true, choix: ['Haute pression', 'Sablage', 'Gommage', 'Nébulisation', 'Peeling chimique'] },
              ],
            },
          ],
        },
        {
          nom: 'ITE',
          description: 'Isolation thermique par l\'extérieur',
          prestations: [
            {
              nom: 'Isolation thermique extérieure (ITE)', unite: 'M2', prixVenteMin: 100, prixVenteMax: 200,
              description: 'Isolation thermique par l\'extérieur avec enduit de finition',
              options: [
                { nom: 'Type d\'isolant', obligatoire: true, choix: ['Polystyrène expansé (PSE)', 'Laine de roche', 'Fibre de bois', 'Polyuréthane'] },
                { nom: 'Épaisseur', obligatoire: true, choix: ['100mm', '120mm', '140mm', '160mm', '200mm'] },
                { nom: 'Finition', obligatoire: true, choix: ['Enduit taloché', 'Enduit gratté', 'Bardage bois', 'Bardage composite'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 14. CHAUFFAGE / CLIMATISATION ──
    {
      categorie: 'Chauffage / Climatisation',
      description: 'Installation de systèmes de chauffage et climatisation',
      sousCategories: [
        {
          nom: 'Radiateurs',
          description: 'Pose de radiateurs',
          prestations: [
            {
              nom: 'Pose radiateur', unite: 'PIECE', prixVenteMin: 150, prixVenteMax: 500,
              description: 'Pose d\'un radiateur',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Électrique à inertie', 'Électrique rayonnant', 'Eau chaude (acier)', 'Eau chaude (fonte)', 'Sèche-serviette'] },
              ],
            },
          ],
        },
        {
          nom: 'Plancher chauffant',
          description: 'Installation de plancher chauffant',
          prestations: [
            {
              nom: 'Pose plancher chauffant', unite: 'M2', prixVenteMin: 50, prixVenteMax: 120,
              description: 'Installation de plancher chauffant',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Hydraulique (eau)', 'Électrique (câble)', 'Électrique (trame)'] },
              ],
            },
          ],
        },
        {
          nom: 'Climatisation',
          description: 'Installation de climatisation',
          prestations: [
            {
              nom: 'Installation climatisation', unite: 'PIECE', prixVenteMin: 800, prixVenteMax: 3000,
              description: 'Installation d\'un système de climatisation',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Split mural', 'Multi-split', 'Gainable', 'Console', 'Cassette'] },
                { nom: 'Puissance', obligatoire: true, choix: ['2.5 kW (< 25 m²)', '3.5 kW (25-35 m²)', '5 kW (35-50 m²)', '7 kW (> 50 m²)'] },
              ],
            },
          ],
        },
        {
          nom: 'Chaudière / PAC',
          description: 'Installation de chaudière et pompe à chaleur',
          prestations: [
            {
              nom: 'Remplacement chaudière', unite: 'FORFAIT', prixVenteMin: 3000, prixVenteMax: 12000,
              description: 'Dépose + pose chaudière ou PAC',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Chaudière gaz condensation', 'Pompe à chaleur air/eau', 'Pompe à chaleur air/air', 'Chaudière granulés', 'Poêle à granulés'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 15. VENTILATION ──
    {
      categorie: 'Ventilation',
      description: 'Installation de systèmes de ventilation',
      sousCategories: [
        {
          nom: 'VMC',
          description: 'Installation de VMC',
          prestations: [
            {
              nom: 'Installation VMC', unite: 'FORFAIT', prixVenteMin: 500, prixVenteMax: 3000,
              description: 'Installation complète d\'un système VMC',
              options: [
                { nom: 'Type de VMC', obligatoire: true, choix: ['Simple flux autoréglable', 'Simple flux hygroréglable A', 'Simple flux hygroréglable B', 'Double flux'] },
                { nom: 'Nombre de bouches', obligatoire: false, choix: ['3 bouches', '4 bouches', '5 bouches', '6 bouches'] },
              ],
            },
          ],
        },
        {
          nom: 'Extracteurs',
          description: 'Pose d\'extracteurs',
          prestations: [
            {
              nom: 'Pose extracteur', unite: 'PIECE', prixVenteMin: 80, prixVenteMax: 250,
              description: 'Pose d\'un extracteur d\'air',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Extracteur salle de bain', 'Extracteur cuisine', 'Aérateur mural', 'Extracteur mécanique en ligne'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 16. AMÉNAGEMENT EXTÉRIEUR ──
    {
      categorie: 'Aménagement extérieur',
      description: 'Terrasse, clôture, portail, allée, pergola',
      sousCategories: [
        {
          nom: 'Terrasse',
          description: 'Création de terrasse',
          prestations: [
            {
              nom: 'Pose terrasse', unite: 'M2', prixVenteMin: 50, prixVenteMax: 150,
              description: 'Création de terrasse extérieure',
              options: [
                { nom: 'Matériau', obligatoire: true, choix: ['Bois naturel (pin traité)', 'Bois exotique (ipé, teck)', 'Composite', 'Carrelage extérieur', 'Pierre naturelle', 'Dalle béton'] },
                { nom: 'Structure', obligatoire: false, choix: ['Sur lambourdes bois', 'Sur plots réglables', 'Collée sur dalle'] },
              ],
            },
          ],
        },
        {
          nom: 'Clôture',
          description: 'Pose de clôture',
          prestations: [
            {
              nom: 'Pose clôture', unite: 'ML', prixVenteMin: 30, prixVenteMax: 120,
              description: 'Pose de clôture avec poteaux',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Grillage souple', 'Panneaux rigides', 'Palissade bois', 'Panneaux alu', 'Gabions', 'Mur en parpaing'] },
                { nom: 'Hauteur', obligatoire: true, choix: ['1.00m', '1.20m', '1.50m', '1.80m', '2.00m'] },
              ],
            },
          ],
        },
        {
          nom: 'Portail',
          description: 'Pose de portail',
          prestations: [
            {
              nom: 'Pose portail', unite: 'FORFAIT', prixVenteMin: 500, prixVenteMax: 3000,
              description: 'Pose de portail avec poteaux',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Battant 2 vantaux', 'Coulissant', 'Portillon'] },
                { nom: 'Matériau', obligatoire: true, choix: ['Aluminium', 'Fer forgé', 'PVC', 'Bois'] },
                { nom: 'Motorisation', obligatoire: false, choix: ['Manuel', 'Motorisé (vérins)', 'Motorisé (bras articulés)', 'Motorisé (rail au sol)'] },
              ],
            },
          ],
        },
        {
          nom: 'Allées',
          description: 'Création d\'allées',
          prestations: [
            {
              nom: 'Création allée', unite: 'M2', prixVenteMin: 30, prixVenteMax: 100,
              description: 'Création d\'allée piétonne ou carrossable',
              options: [
                { nom: 'Matériau', obligatoire: true, choix: ['Graviers stabilisés', 'Béton désactivé', 'Béton imprimé', 'Pavés autobloquants', 'Dalles pierre naturelle', 'Enrobé'] },
              ],
            },
          ],
        },
        {
          nom: 'Pergola',
          description: 'Pose de pergola',
          prestations: [
            {
              nom: 'Pose pergola', unite: 'FORFAIT', prixVenteMin: 2000, prixVenteMax: 8000,
              description: 'Pose de pergola',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Bois', 'Aluminium classique', 'Bioclimatique (lames orientables)', 'Toile rétractable'] },
                { nom: 'Surface', obligatoire: true, choix: ['< 10 m²', '10-15 m²', '15-20 m²', '> 20 m²'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 17. CUISINE ──
    {
      categorie: 'Cuisine',
      description: 'Aménagement et rénovation de cuisine',
      sousCategories: [
        {
          nom: 'Meubles',
          description: 'Pose de meubles de cuisine',
          prestations: [
            {
              nom: 'Pose cuisine équipée', unite: 'ML', prixVenteMin: 200, prixVenteMax: 600,
              description: 'Pose de meubles de cuisine équipée (par mètre linéaire)',
              options: [
                { nom: 'Gamme', obligatoire: true, choix: ['Entrée de gamme (mélaminé)', 'Milieu de gamme (stratifié)', 'Haut de gamme (laqué / bois massif)'] },
              ],
            },
          ],
        },
        {
          nom: 'Plan de travail',
          description: 'Pose de plan de travail',
          prestations: [
            {
              nom: 'Pose plan de travail', unite: 'ML', prixVenteMin: 60, prixVenteMax: 300,
              description: 'Pose de plan de travail cuisine',
              options: [
                { nom: 'Matériau', obligatoire: true, choix: ['Stratifié', 'Granit', 'Quartz (Silestone)', 'Bois massif', 'Inox', 'Céramique', 'Dekton / Neolith'] },
              ],
            },
          ],
        },
        {
          nom: 'Crédence',
          description: 'Pose de crédence',
          prestations: [
            {
              nom: 'Pose crédence cuisine', unite: 'ML', prixVenteMin: 40, prixVenteMax: 150,
              description: 'Pose de crédence de cuisine',
              options: [
                { nom: 'Matériau', obligatoire: true, choix: ['Carrelage / faïence', 'Verre trempé', 'Inox brossé', 'Stratifié', 'Pierre naturelle'] },
              ],
            },
          ],
        },
        {
          nom: 'Électroménager',
          description: 'Installation d\'électroménager',
          prestations: [
            {
              nom: 'Installation électroménager', unite: 'PIECE', prixVenteMin: 50, prixVenteMax: 200,
              description: 'Installation et raccordement d\'un appareil électroménager',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Four encastrable', 'Plaque de cuisson', 'Hotte aspirante', 'Lave-vaisselle', 'Réfrigérateur encastrable', 'Micro-ondes encastrable'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 18. SALLE DE BAIN ──
    {
      categorie: 'Salle de bain',
      description: 'Aménagement et rénovation de salle de bain',
      sousCategories: [
        {
          nom: 'Aménagement complet',
          description: 'Rénovation complète de salle de bain',
          prestations: [
            {
              nom: 'Rénovation SDB complète', unite: 'FORFAIT', prixVenteMin: 4000, prixVenteMax: 15000,
              description: 'Rénovation complète de salle de bain (dépose + plomberie + carrelage + équipements)',
              options: [
                { nom: 'Surface', obligatoire: true, choix: ['< 4 m²', '4-6 m²', '6-8 m²', '> 8 m²'] },
                { nom: 'Gamme', obligatoire: true, choix: ['Économique', 'Standard', 'Premium', 'Luxe'] },
              ],
            },
          ],
        },
        {
          nom: 'Meuble vasque',
          description: 'Pose de meuble vasque',
          prestations: [
            {
              nom: 'Pose meuble vasque', unite: 'PIECE', prixVenteMin: 200, prixVenteMax: 800,
              description: 'Pose d\'un meuble vasque avec robinetterie',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Simple vasque (60cm)', 'Simple vasque (80cm)', 'Double vasque (120cm)', 'Suspendu', 'Sur pied'] },
              ],
            },
          ],
        },
        {
          nom: 'Paroi de douche',
          description: 'Pose de paroi de douche',
          prestations: [
            {
              nom: 'Pose paroi de douche', unite: 'PIECE', prixVenteMin: 200, prixVenteMax: 700,
              description: 'Pose d\'une paroi de douche',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Paroi fixe', 'Porte battante', 'Porte coulissante', 'Porte pliante', 'Paroi walk-in'] },
                { nom: 'Verre', obligatoire: false, choix: ['Transparent', 'Sérigraphié', 'Dépoli', 'Fumé'] },
              ],
            },
          ],
        },
        {
          nom: 'Accessoires',
          description: 'Pose d\'accessoires de salle de bain',
          prestations: [
            {
              nom: 'Pose accessoires SDB', unite: 'FORFAIT', prixVenteMin: 100, prixVenteMax: 400,
              description: 'Pose d\'accessoires de salle de bain (porte-serviette, miroir, etc.)',
              options: [
                { nom: 'Pack', obligatoire: true, choix: ['Pack standard (3 accessoires)', 'Pack complet (6 accessoires)', 'Pack PMR / accessibilité', 'Pack design / premium'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 19. SOLS TECHNIQUES ──
    {
      categorie: 'Sols techniques',
      description: 'Ragréage, chapes spéciales, résine de sol',
      sousCategories: [
        {
          nom: 'Chape',
          description: 'Chapes fluides et spéciales',
          prestations: [
            {
              nom: 'Chape fluide', unite: 'M2', prixVenteMin: 25, prixVenteMax: 55,
              description: 'Réalisation de chape fluide autonivelante',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Anhydrite (sulfate de calcium)', 'Ciment'] },
                { nom: 'Épaisseur', obligatoire: true, choix: ['3-4 cm', '5-6 cm', '7-8 cm'] },
              ],
            },
          ],
        },
        {
          nom: 'Résine',
          description: 'Sols en résine',
          prestations: [
            {
              nom: 'Sol résine', unite: 'M2', prixVenteMin: 50, prixVenteMax: 120,
              description: 'Application de sol en résine',
              options: [
                { nom: 'Type de résine', obligatoire: true, choix: ['Époxy', 'Polyuréthane', 'Méthacrylate'] },
                { nom: 'Finition', obligatoire: true, choix: ['Lisse brillant', 'Lisse mat', 'Quartz coloré (antidérapant)', 'Effet béton'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 20. TRAITEMENT / ASSAINISSEMENT ──
    {
      categorie: 'Traitement / Assainissement',
      description: 'Traitement humidité, termites, assainissement',
      sousCategories: [
        {
          nom: 'Humidité',
          description: 'Traitement des problèmes d\'humidité',
          prestations: [
            {
              nom: 'Traitement humidité', unite: 'ML', prixVenteMin: 80, prixVenteMax: 200,
              description: 'Traitement des remontées capillaires et infiltrations',
              options: [
                { nom: 'Technique', obligatoire: true, choix: ['Injection de résine', 'Drainage périphérique', 'Cuvelage', 'Membrane d\'étanchéité'] },
              ],
            },
          ],
        },
        {
          nom: 'Termites',
          description: 'Traitement anti-termites',
          prestations: [
            {
              nom: 'Traitement termites', unite: 'FORFAIT', prixVenteMin: 1500, prixVenteMax: 5000,
              description: 'Traitement anti-termites et insectes xylophages',
              options: [
                { nom: 'Type de traitement', obligatoire: true, choix: ['Barrière chimique', 'Pièges (stations appât)', 'Injection bois'] },
              ],
            },
          ],
        },
        {
          nom: 'Assainissement',
          description: 'Travaux d\'assainissement',
          prestations: [
            {
              nom: 'Assainissement non collectif', unite: 'FORFAIT', prixVenteMin: 5000, prixVenteMax: 15000,
              description: 'Installation ou remplacement d\'un système d\'assainissement individuel',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Fosse septique toutes eaux', 'Micro-station d\'épuration', 'Filtre compact', 'Filtre à sable'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 21. SERRURERIE / MÉTALLERIE ──
    {
      categorie: 'Serrurerie / Métallerie',
      description: 'Garde-corps, rampes, grilles de protection',
      sousCategories: [
        {
          nom: 'Garde-corps',
          description: 'Pose de garde-corps',
          prestations: [
            {
              nom: 'Pose garde-corps', unite: 'ML', prixVenteMin: 100, prixVenteMax: 350,
              description: 'Pose de garde-corps',
              options: [
                { nom: 'Matériau', obligatoire: true, choix: ['Inox', 'Aluminium', 'Fer forgé', 'Verre + inox', 'Câbles + inox'] },
                { nom: 'Type', obligatoire: true, choix: ['À barreaux', 'À lisses horizontales', 'Vitré', 'À câbles'] },
              ],
            },
          ],
        },
        {
          nom: 'Rampes',
          description: 'Pose de rampes d\'escalier',
          prestations: [
            {
              nom: 'Pose rampe escalier', unite: 'ML', prixVenteMin: 60, prixVenteMax: 200,
              description: 'Pose de rampe et main courante d\'escalier',
              options: [
                { nom: 'Matériau', obligatoire: true, choix: ['Bois', 'Inox', 'Fer forgé', 'Corde'] },
              ],
            },
          ],
        },
        {
          nom: 'Grilles de protection',
          description: 'Pose de grilles et protections',
          prestations: [
            {
              nom: 'Pose grille de défense', unite: 'PIECE', prixVenteMin: 150, prixVenteMax: 500,
              description: 'Pose de grille de défense sur fenêtre',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Fixe (scellée)', 'Ouvrante', 'Amovible'] },
                { nom: 'Matériau', obligatoire: true, choix: ['Fer forgé', 'Acier peint', 'Aluminium'] },
              ],
            },
          ],
        },
      ],
    },

    // ── 22. VITRERIE ──
    {
      categorie: 'Vitrerie',
      description: 'Vitrages, miroirs, cloisons vitrées et verrières',
      sousCategories: [
        {
          nom: 'Vitrage',
          description: 'Remplacement de vitrage',
          prestations: [
            {
              nom: 'Remplacement vitrage', unite: 'M2', prixVenteMin: 80, prixVenteMax: 200,
              description: 'Remplacement de vitrage sur menuiserie existante',
              options: [
                { nom: 'Type de vitrage', obligatoire: true, choix: ['Simple vitrage', 'Double vitrage standard', 'Double vitrage ITR argon', 'Triple vitrage', 'Vitrage feuilleté sécurité'] },
              ],
            },
          ],
        },
        {
          nom: 'Miroirs',
          description: 'Pose de miroirs',
          prestations: [
            {
              nom: 'Pose miroir', unite: 'M2', prixVenteMin: 60, prixVenteMax: 150,
              description: 'Fourniture et pose de miroir sur mesure',
              options: [
                { nom: 'Fixation', obligatoire: true, choix: ['Collé', 'Fixation mécanique (pattes)'] },
                { nom: 'Finition', obligatoire: false, choix: ['Bords polis', 'Bords biseautés', 'Avec cadre'] },
              ],
            },
          ],
        },
        {
          nom: 'Cloisons vitrées',
          description: 'Pose de cloisons vitrées et verrières',
          prestations: [
            {
              nom: 'Pose verrière intérieure', unite: 'ML', prixVenteMin: 300, prixVenteMax: 800,
              description: 'Pose de verrière d\'intérieur style atelier',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Verrière fixe', 'Verrière avec porte', 'Verrière imposte (au-dessus d\'une porte)', 'Verrière cloison complète'] },
                { nom: 'Matériau cadre', obligatoire: true, choix: ['Acier noir', 'Aluminium noir', 'Aluminium blanc', 'Bois peint'] },
              ],
            },
            {
              nom: 'Pose cloison vitrée bureau', unite: 'M2', prixVenteMin: 150, prixVenteMax: 400,
              description: 'Pose de cloison vitrée de bureau ou séparation',
              options: [
                { nom: 'Type', obligatoire: true, choix: ['Vitrée toute hauteur', 'Semi-vitrée (allège)', 'Coulissante'] },
              ],
            },
          ],
        },
      ],
    },
  ];

  // ── Insertion en base ──
  const categories: Record<string, any> = {};
  const sousCategories: Record<string, any> = {};
  const prestations: Record<string, any> = {};
  let totalPrestations = 0;
  let totalOptions = 0;
  let totalChoix = 0;

  for (const cat of catalogue) {
    // Upsert catégorie
    const createdCat = await prisma.categoriePrestation.upsert({
      where: { companyId_nom: { companyId: company.id, nom: cat.categorie } },
      update: { description: cat.description },
      create: { companyId: company.id, nom: cat.categorie, description: cat.description },
    });
    categories[cat.categorie] = createdCat;

    for (const sc of cat.sousCategories) {
      // Upsert sous-catégorie
      const createdSc = await prisma.sousCategorie.upsert({
        where: { categorieId_nom: { categorieId: createdCat.id, nom: sc.nom } },
        update: { description: sc.description },
        create: {
          companyId: company.id,
          categorieId: createdCat.id,
          nom: sc.nom,
          description: sc.description,
        },
      });
      sousCategories[`${cat.categorie}/${sc.nom}`] = createdSc;

      for (const p of sc.prestations) {
        // Upsert prestation
        let presta = await prisma.prestation.findFirst({
          where: { companyId: company.id, categorieId: createdCat.id, sousCategorieId: createdSc.id, nom: p.nom },
        });
        if (!presta) {
          presta = await prisma.prestation.create({
            data: {
              companyId: company.id,
              categorieId: createdCat.id,
              sousCategorieId: createdSc.id,
              nom: p.nom,
              unite: p.unite as any,
              prixVenteMin: p.prixVenteMin,
              prixVenteMax: p.prixVenteMax,
              description: p.description,
            },
          });
        }
        prestations[p.nom] = presta;
        totalPrestations++;

        // Options et choix
        for (const opt of p.options) {
          if (!opt.nom) continue;
          let option = await prisma.optionPrestation.findUnique({
            where: { prestationId_nom: { prestationId: presta.id, nom: opt.nom } },
          });
          if (!option) {
            option = await prisma.optionPrestation.create({
              data: {
                prestationId: presta.id,
                nom: opt.nom,
                obligatoire: opt.obligatoire ?? false,
              },
            });
          }
          totalOptions++;

          for (let i = 0; i < opt.choix.length; i++) {
            const choixItem = opt.choix[i];
            const choixNom = typeof choixItem === 'string' ? choixItem : (choixItem as { nom: string; impactPrix?: number }).nom;
            const choixImpact = typeof choixItem === 'string' ? 0 : (choixItem as { nom: string; impactPrix?: number }).impactPrix ?? 0;
            const existing = await prisma.choixOption.findUnique({
              where: { optionId_nom: { optionId: option.id, nom: choixNom } },
            });
            if (existing) {
              await prisma.choixOption.update({
                where: { id: existing.id },
                data: {
                  impactPrix: choixImpact,
                  ordre: i,
                  actif: true,
                },
              });
            } else {
              await prisma.choixOption.create({
                data: {
                  optionId: option.id,
                  nom: choixNom,
                  impactPrix: choixImpact,
                  ordre: i,
                },
              });
            }
            totalChoix++;
          }
        }
      }
    }
  }

  console.log(`✅ ${Object.keys(categories).length} catégories de prestations créées`);
  console.log(`✅ ${Object.keys(sousCategories).length} sous-catégories créées`);
  console.log(`✅ ${totalPrestations} prestations créées dans le catalogue`);
  console.log(`✅ ${totalOptions} options de prestation créées`);
  console.log(`✅ ${totalChoix} choix d'options créés`);

  // 5. Créer les matériaux (bibliothèque de prix d'achat)
  const materiauxData = [
    // Carrelage
    {
      nom: 'Carrelage grès cérame 20x20',
      couleur: 'Beige sable',
      finition: 'Mat',
      unite: 'M2',
      prixAchatFixe: 10.8,
    },
    {
      nom: 'Carrelage grès cérame 60x60',
      couleur: 'Gris anthracite',
      finition: 'Mat',
      unite: 'M2',
      prixAchatFixe: 18.5,
    },
    {
      nom: 'Carrelage grès cérame 30x30',
      couleur: 'Beige',
      finition: 'Mat',
      unite: 'M2',
      prixAchatFixe: 14.0,
    },
    {
      nom: 'Carrelage grès cérame 45x45',
      couleur: 'Ivoire',
      finition: 'Mat',
      unite: 'M2',
      prixAchatFixe: 15.2,
    },
    {
      nom: 'Carrelage grès cérame 30x60',
      couleur: 'Gris clair',
      finition: 'Satin',
      unite: 'M2',
      prixAchatFixe: 16.8,
    },
    {
      nom: 'Carrelage grès cérame 120x60',
      couleur: 'Béton naturel',
      finition: 'Mat',
      unite: 'M2',
      prixAchatFixe: 27.5,
    },
    {
      nom: 'Carrelage grès cérame 120x120',
      couleur: 'Pierre claire',
      finition: 'Lappato',
      unite: 'M2',
      prixAchatFixe: 39.0,
    },
    {
      nom: 'Faïence murale 30x60',
      couleur: 'Blanc',
      finition: 'Brillant',
      unite: 'M2',
      prixAchatFixe: 16.0,
    },
    {
      nom: 'Carrelage mural 10x10',
      couleur: 'Blanc cassé',
      finition: 'Brillant',
      unite: 'M2',
      prixAchatFixe: 11.5,
    },
    {
      nom: 'Carrelage métro 10x20',
      couleur: 'Blanc',
      finition: 'Brillant',
      unite: 'M2',
      prixAchatFixe: 14.5,
    },
    {
      nom: 'Carrelage mural 20x20',
      couleur: 'Blanc neige',
      finition: 'Satin',
      unite: 'M2',
      prixAchatFixe: 13.8,
    },
    {
      nom: 'Carrelage mural 25x75',
      couleur: 'Gris perle',
      finition: 'Mat',
      unite: 'M2',
      prixAchatFixe: 24.0,
    },
    {
      nom: 'Zellige artisanal 10x10',
      couleur: 'Vert jade',
      finition: 'Brillant irrégulier',
      unite: 'M2',
      prixAchatFixe: 38.0,
    },
    {
      nom: 'Mosaïque pâte de verre 2x2',
      couleur: 'Bleu lagon',
      finition: 'Brillant',
      unite: 'M2',
      prixAchatFixe: 32.0,
    },
    {
      nom: 'Carreaux de ciment 20x20',
      couleur: 'Graphique noir et blanc',
      finition: 'Mat',
      unite: 'M2',
      prixAchatFixe: 29.0,
    },
    {
      nom: 'Colle carrelage C1 (25kg)',
      couleur: null,
      finition: null,
      unite: 'KG',
      prixAchatFixe: 9.0,
    },
    {
      nom: 'Colle carrelage C2 (25kg)',
      couleur: null,
      finition: null,
      unite: 'KG',
      prixAchatFixe: 12.5,
    },
    {
      nom: 'Colle carrelage C2S1 (25kg)',
      couleur: null,
      finition: null,
      unite: 'KG',
      prixAchatFixe: 14.5,
    },
    {
      nom: 'Colle carrelage C2S2 (25kg)',
      couleur: null,
      finition: null,
      unite: 'KG',
      prixAchatFixe: 17.5,
    },
    {
      nom: 'Joint carrelage (5kg)',
      couleur: 'Gris',
      finition: null,
      unite: 'KG',
      prixAchatFixe: 8.0,
    },
    {
      nom: 'Ragréage autolissant P3 (25kg)',
      couleur: null,
      finition: null,
      unite: 'KG',
      prixAchatFixe: 16.0,
    },
    {
      nom: 'Ragréage autolissant P4 (25kg)',
      couleur: null,
      finition: null,
      unite: 'KG',
      prixAchatFixe: 22.0,
    },
    {
      nom: 'Ragréage fibré haute résistance (25kg)',
      couleur: null,
      finition: null,
      unite: 'KG',
      prixAchatFixe: 26.0,
    },
    {
      nom: 'Primaire d\'accrochage universel (5L)',
      couleur: null,
      finition: null,
      unite: 'LITRE',
      prixAchatFixe: 6.5,
    },

    // Peinture
    {
      nom: 'Peinture acrylique mat 10L',
      couleur: 'Blanc',
      finition: 'Mat',
      unite: 'LITRE',
      prixAchatFixe: 45.0,
    },
    {
      nom: 'Peinture acrylique satin 10L',
      couleur: 'Blanc',
      finition: 'Satin',
      unite: 'LITRE',
      prixAchatFixe: 55.0,
    },
    {
      nom: 'Sous-couche universelle 10L',
      couleur: 'Blanc',
      finition: null,
      unite: 'LITRE',
      prixAchatFixe: 35.0,
    },
    {
      nom: 'Enduit de lissage (25kg)',
      couleur: 'Blanc',
      finition: null,
      unite: 'KG',
      prixAchatFixe: 18.0,
    },

    // Plomberie
    {
      nom: 'Receveur douche 80x120',
      couleur: 'Blanc',
      finition: null,
      unite: 'PIECE',
      prixAchatFixe: 180.0,
    },
    {
      nom: 'Mitigeur douche thermostatique',
      couleur: 'Chrome',
      finition: 'Brillant',
      unite: 'PIECE',
      prixAchatFixe: 120.0,
    },
    {
      nom: 'WC complet avec réservoir',
      couleur: 'Blanc',
      finition: null,
      unite: 'PIECE',
      prixAchatFixe: 150.0,
    },
    {
      nom: 'Lavabo vasque 60cm',
      couleur: 'Blanc',
      finition: null,
      unite: 'PIECE',
      prixAchatFixe: 85.0,
    },
    {
      nom: 'Chauffe-eau électrique 200L',
      couleur: null,
      finition: null,
      unite: 'PIECE',
      prixAchatFixe: 350.0,
    },
    {
      nom: 'Tube PER 16mm (couronne 100m)',
      couleur: null,
      finition: null,
      unite: 'ML',
      prixAchatFixe: 1.2,
    },

    // Électricité
    {
      nom: 'Câble R2V 3G2.5 (100m)',
      couleur: null,
      finition: null,
      unite: 'ML',
      prixAchatFixe: 1.5,
    },
    {
      nom: 'Prise électrique encastrée',
      couleur: 'Blanc',
      finition: null,
      unite: 'PIECE',
      prixAchatFixe: 5.5,
    },
    {
      nom: 'Interrupteur va-et-vient',
      couleur: 'Blanc',
      finition: null,
      unite: 'PIECE',
      prixAchatFixe: 6.0,
    },
    {
      nom: 'Spot LED encastré 7W',
      couleur: null,
      finition: null,
      unite: 'PIECE',
      prixAchatFixe: 12.0,
    },
    {
      nom: 'Tableau électrique 2 rangées',
      couleur: null,
      finition: null,
      unite: 'PIECE',
      prixAchatFixe: 85.0,
    },
    {
      nom: 'Disjoncteur 20A',
      couleur: null,
      finition: null,
      unite: 'PIECE',
      prixAchatFixe: 15.0,
    },

    // Maçonnerie
    {
      nom: 'Plaque de plâtre BA13 (2.5x1.2m)',
      couleur: null,
      finition: null,
      unite: 'PIECE',
      prixAchatFixe: 6.5,
    },
    {
      nom: 'Rail métallique R48 (3m)',
      couleur: null,
      finition: null,
      unite: 'ML',
      prixAchatFixe: 2.0,
    },
    {
      nom: 'Montant M48 (3m)',
      couleur: null,
      finition: null,
      unite: 'ML',
      prixAchatFixe: 2.2,
    },
    {
      nom: 'Sac ciment 35kg',
      couleur: null,
      finition: null,
      unite: 'KG',
      prixAchatFixe: 8.5,
    },
    {
      nom: 'Sable fin (25kg)',
      couleur: null,
      finition: null,
      unite: 'KG',
      prixAchatFixe: 3.5,
    },
    {
      nom: 'Polystyrène expansé (m³)',
      couleur: null,
      finition: null,
      unite: 'PIECE',
      prixAchatFixe: 22.0,
    },
    {
      nom: 'Fibres de polypropylène (1kg)',
      couleur: null,
      finition: null,
      unite: 'KG',
      prixAchatFixe: 4.5,
    },
    {
      nom: 'Anhydrite (25kg)',
      couleur: null,
      finition: null,
      unite: 'KG',
      prixAchatFixe: 6.0,
    },
    {
      nom: 'IPN 200 (6m)',
      couleur: null,
      finition: null,
      unite: 'ML',
      prixAchatFixe: 45.0,
    },

    // Menuiserie
    {
      nom: 'Bloc porte intérieur 83cm',
      couleur: 'Blanc',
      finition: 'Lisse',
      unite: 'PIECE',
      prixAchatFixe: 75.0,
    },
    {
      nom: 'Fenêtre PVC 2 vantaux 120x135',
      couleur: 'Blanc',
      finition: null,
      unite: 'PIECE',
      prixAchatFixe: 180.0,
    },

    // Isolation
    {
      nom: 'Laine de verre GR32 100mm (R=3.15)',
      couleur: null,
      finition: null,
      unite: 'M2',
      prixAchatFixe: 8.0,
    },
    {
      nom: 'Laine de roche soufflée (sac 12.5kg)',
      couleur: null,
      finition: null,
      unite: 'KG',
      prixAchatFixe: 15.0,
    },

    // Revêtement de sol
    {
      nom: 'Parquet flottant chêne 7mm',
      couleur: 'Chêne naturel',
      finition: 'Verni',
      unite: 'M2',
      prixAchatFixe: 12.0,
    },
    {
      nom: 'Parquet massif chêne 14mm',
      couleur: 'Chêne naturel',
      finition: 'Brut',
      unite: 'M2',
      prixAchatFixe: 35.0,
    },
    {
      nom: 'Sol PVC lame clipsable',
      couleur: 'Gris béton',
      finition: null,
      unite: 'M2',
      prixAchatFixe: 8.0,
    },
    {
      nom: 'Sous-couche parquet 3mm',
      couleur: null,
      finition: null,
      unite: 'M2',
      prixAchatFixe: 2.5,
    },
  ];

  for (const m of materiauxData) {
    const existing = await prisma.materiau.findFirst({
      where: {
        companyId: company.id,
        nom: m.nom,
      },
    });

    if (!existing) {
      await prisma.materiau.create({
        data: {
          companyId: company.id,
          nom: m.nom,
          couleur: m.couleur,
          finition: m.finition,
          unite: m.unite as any,
          prixAchatFixe: m.prixAchatFixe,
        },
      });
    }
  }
  console.log(
    `✅ ${materiauxData.length} matériaux créés dans la bibliothèque de prix`,
  );

  // 6. Créer les services de main d'œuvre
  const servicesMoData = [
    {
      nom: 'Pose carrelage sol',
      unite: 'M2',
      prixUnitaire: 25,
      productiviteJour: 15,
      coutJournalier: 250,
    },
    {
      nom: 'Pose carrelage mural',
      unite: 'M2',
      prixUnitaire: 30,
      productiviteJour: 12,
      coutJournalier: 250,
    },
    {
      nom: 'Pose faïence',
      unite: 'M2',
      prixUnitaire: 32,
      productiviteJour: 10,
      coutJournalier: 250,
    },
    {
      nom: 'Ragréage sol',
      unite: 'M2',
      prixUnitaire: 10,
      productiviteJour: 30,
      coutJournalier: 250,
    },
    {
      nom: 'Peinture mur (2 couches)',
      unite: 'M2',
      prixUnitaire: 8,
      productiviteJour: 25,
      coutJournalier: 220,
    },
    {
      nom: 'Peinture plafond (2 couches)',
      unite: 'M2',
      prixUnitaire: 10,
      productiviteJour: 20,
      coutJournalier: 220,
    },
    {
      nom: 'Enduit mur',
      unite: 'M2',
      prixUnitaire: 12,
      productiviteJour: 18,
      coutJournalier: 220,
    },
    {
      nom: 'Plomberie — pose sanitaire',
      unite: 'HEURE',
      prixUnitaire: 45,
      productiviteJour: 8,
      coutJournalier: 280,
    },
    {
      nom: 'Plomberie — raccordement',
      unite: 'HEURE',
      prixUnitaire: 50,
      productiviteJour: 8,
      coutJournalier: 280,
    },
    {
      nom: 'Électricité — câblage',
      unite: 'HEURE',
      prixUnitaire: 45,
      productiviteJour: 8,
      coutJournalier: 270,
    },
    {
      nom: 'Électricité — pose appareillage',
      unite: 'PIECE',
      prixUnitaire: 15,
      productiviteJour: 20,
      coutJournalier: 270,
    },
    {
      nom: 'Montage cloison placo',
      unite: 'M2',
      prixUnitaire: 20,
      productiviteJour: 12,
      coutJournalier: 240,
    },
    {
      nom: 'Démolition cloison',
      unite: 'M2',
      prixUnitaire: 8,
      productiviteJour: 25,
      coutJournalier: 200,
    },
    {
      nom: 'Chape béton',
      unite: 'M2',
      prixUnitaire: 12,
      productiviteJour: 20,
      coutJournalier: 250,
    },
    {
      nom: 'Pose porte intérieure',
      unite: 'PIECE',
      prixUnitaire: 80,
      productiviteJour: 3,
      coutJournalier: 250,
    },
    {
      nom: 'Pose fenêtre',
      unite: 'PIECE',
      prixUnitaire: 120,
      productiviteJour: 2,
      coutJournalier: 260,
    },
    {
      nom: 'Isolation laine de verre',
      unite: 'M2',
      prixUnitaire: 12,
      productiviteJour: 20,
      coutJournalier: 230,
    },
    {
      nom: 'Isolation combles soufflage',
      unite: 'M2',
      prixUnitaire: 8,
      productiviteJour: 40,
      coutJournalier: 230,
    },
    {
      nom: 'Pose parquet flottant',
      unite: 'M2',
      prixUnitaire: 12,
      productiviteJour: 20,
      coutJournalier: 230,
    },
    {
      nom: 'Pose parquet massif',
      unite: 'M2',
      prixUnitaire: 25,
      productiviteJour: 10,
      coutJournalier: 250,
    },
    {
      nom: 'Pose sol PVC',
      unite: 'M2',
      prixUnitaire: 8,
      productiviteJour: 30,
      coutJournalier: 220,
    },
    {
      nom: 'Ravalement façade',
      unite: 'M2',
      prixUnitaire: 20,
      productiviteJour: 10,
      coutJournalier: 250,
    },
    {
      nom: 'Couverture toiture',
      unite: 'M2',
      prixUnitaire: 35,
      productiviteJour: 8,
      coutJournalier: 260,
    },
    {
      nom: 'Nettoyage toiture',
      unite: 'M2',
      prixUnitaire: 5,
      productiviteJour: 40,
      coutJournalier: 200,
    },
  ];

  for (const s of servicesMoData) {
    const existing = await prisma.serviceMainOeuvre.findFirst({
      where: {
        companyId: company.id,
        nom: s.nom,
      },
    });

    if (!existing) {
      await prisma.serviceMainOeuvre.create({
        data: {
          companyId: company.id,
          nom: s.nom,
          unite: s.unite as any,
          prixUnitaire: s.prixUnitaire,
          productiviteJour: s.productiviteJour,
          coutJournalier: s.coutJournalier,
        },
      });
    }
  }
  console.log(`✅ ${servicesMoData.length} services main d'œuvre créés`);

  // 7. Créer les fournisseurs
  const fournisseursData = [
    {
      nom: 'Point P',
      contact: 'Jean Dupont',
      email: 'pro@pointp.fr',
      telephone: '01 40 55 66 77',
      adresse: '12 Rue du Commerce, 75015 Paris',
      typesMateriaux: 'Gros œuvre, Carrelage, Outillage',
      delaiLivraison: 3,
      conditions: 'Franco 500€ HT — Paiement 30 jours fin de mois',
    },
    {
      nom: 'Céramique France',
      contact: 'Marie Laurent',
      email: 'commandes@ceramique-france.fr',
      telephone: '04 72 33 44 55',
      adresse: '45 Avenue de la Faïencerie, 69003 Lyon',
      typesMateriaux: 'Carrelage, Faïence, Mosaïque',
      delaiLivraison: 5,
      conditions: 'Franco 300€ HT — Paiement à réception de facture',
    },
    {
      nom: 'BigMat',
      contact: 'Pierre Martin',
      email: 'commandes@bigmat.fr',
      telephone: '03 88 22 33 44',
      adresse: '8 Zone Industrielle Nord, 67000 Strasbourg',
      typesMateriaux: 'Gros œuvre, Isolation, Menuiserie',
      delaiLivraison: 2,
      conditions: 'Franco 400€ HT — Paiement 45 jours',
    },
    {
      nom: 'Rexel',
      contact: 'Philippe Bernard',
      email: 'pro@rexel.fr',
      telephone: '01 49 88 77 66',
      adresse: '25 Rue des Électriciens, 92100 Boulogne-Billancourt',
      typesMateriaux: 'Électricité, Domotique',
      delaiLivraison: 1,
      conditions: 'Franco 200€ HT — Paiement 30 jours',
    },
    {
      nom: 'Cedeo',
      contact: 'Sophie Moreau',
      email: 'contact@cedeo.fr',
      telephone: '02 41 55 66 77',
      adresse: '18 Boulevard de la Plomberie, 49000 Angers',
      typesMateriaux: 'Plomberie, Sanitaire, Chauffage',
      delaiLivraison: 3,
      conditions: 'Franco 350€ HT — Paiement 30 jours fin de mois',
    },
    {
      nom: 'Parexlanko',
      contact: 'Alain Giraud',
      email: 'commercial@parexlanko.fr',
      telephone: '04 78 90 11 22',
      adresse: '110 Rue de la Chimie, 69100 Villeurbanne',
      typesMateriaux: 'Peinture, Enduits, Colles',
      delaiLivraison: 4,
      conditions: 'Franco 250€ HT — Paiement 60 jours',
    },
    {
      nom: 'Dispano',
      contact: 'Claire Petit',
      email: 'pro@dispano.fr',
      telephone: '05 56 44 33 22',
      adresse: '7 Rue du Bois, 33000 Bordeaux',
      typesMateriaux: 'Menuiserie, Bois, Revêtement sol',
      delaiLivraison: 5,
      conditions: 'Franco 500€ HT — Paiement 45 jours',
    },
    {
      nom: 'Isover / Saint-Gobain',
      contact: 'Marc Leblanc',
      email: 'isolation@isover.fr',
      telephone: '01 34 55 66 77',
      adresse: '100 Avenue de la Défense, 92400 Courbevoie',
      typesMateriaux: 'Isolation, Plâtrerie, Cloisons',
      delaiLivraison: 3,
      conditions: 'Franco 600€ HT — Paiement 30 jours',
    },
  ];

  const createdFournisseurs: { nom: string; id: number }[] = [];

  for (const f of fournisseursData) {
    const existing = await prisma.fournisseur.findFirst({
      where: {
        companyId: company.id,
        nom: f.nom,
      },
    });

    if (!existing) {
      const created = await prisma.fournisseur.create({
        data: {
          companyId: company.id,
          ...f,
        },
      });
      createdFournisseurs.push({ nom: created.nom, id: created.id });
    } else {
      createdFournisseurs.push({ nom: existing.nom, id: existing.id });
    }
  }
  console.log(`✅ ${fournisseursData.length} fournisseurs créés`);

  // 8. Lier les matériaux à leurs fournisseurs
  const fournisseurByNom = (nom: string) =>
    createdFournisseurs.find((f) => f.nom === nom)?.id ?? null;

  const materiauxFournisseurs: Record<string, string> = {
    // Carrelage → Céramique France & Point P
    'Carrelage grès cérame 20x20': 'Céramique France',
    'Carrelage grès cérame 60x60': 'Céramique France',
    'Carrelage grès cérame 30x30': 'Céramique France',
    'Carrelage grès cérame 45x45': 'Céramique France',
    'Carrelage grès cérame 30x60': 'Céramique France',
    'Carrelage grès cérame 120x60': 'Céramique France',
    'Carrelage grès cérame 120x120': 'Céramique France',
    'Faïence murale 30x60': 'Céramique France',
    'Carrelage mural 10x10': 'Céramique France',
    'Carrelage métro 10x20': 'Céramique France',
    'Carrelage mural 20x20': 'Céramique France',
    'Carrelage mural 25x75': 'Céramique France',
    'Zellige artisanal 10x10': 'Céramique France',
    'Mosaïque pâte de verre 2x2': 'Céramique France',
    'Carreaux de ciment 20x20': 'Céramique France',
    'Colle carrelage C1 (25kg)': 'Point P',
    'Colle carrelage C2 (25kg)': 'Point P',
    'Colle carrelage C2S1 (25kg)': 'Point P',
    'Colle carrelage C2S2 (25kg)': 'Point P',
    'Joint carrelage (5kg)': 'Point P',
    'Ragréage autolissant P3 (25kg)': 'Point P',
    'Ragréage autolissant P4 (25kg)': 'Point P',
    'Ragréage fibré haute résistance (25kg)': 'Point P',
    'Primaire d\'accrochage universel (5L)': 'Point P',

    // Peinture → Parexlanko
    'Peinture acrylique blanche 10L': 'Parexlanko',
    'Peinture acrylique couleur 2.5L': 'Parexlanko',
    'Sous-couche universelle 10L': 'Parexlanko',
    'Enduit de rebouchage 5kg': 'Parexlanko',
    'Enduit de lissage 15kg': 'Parexlanko',

    // Plomberie → Cedeo
    'Tube cuivre Ø14 (barre 4m)': 'Cedeo',
    'Tube PER Ø16 (couronne 25m)': 'Cedeo',
    'Receveur douche 80x80': 'Cedeo',
    'WC complet avec réservoir': 'Cedeo',
    'Robinet mitigeur lavabo': 'Cedeo',
    'Siphon PVC 40mm': 'Cedeo',

    // Électricité → Rexel
    'Câble R2V 3G2.5 (couronne 100m)': 'Rexel',
    'Câble R2V 3G1.5 (couronne 100m)': 'Rexel',
    'Prise électrique 2P+T': 'Rexel',
    'Interrupteur va-et-vient': 'Rexel',
    'Disjoncteur 20A': 'Rexel',
    'Tableau électrique 2 rangées': 'Rexel',

    // Plâtrerie → Isover / Saint-Gobain
    'Plaque plâtre BA13 (2.5m x 1.2m)': 'Isover / Saint-Gobain',
    'Rail R48 (3m)': 'Isover / Saint-Gobain',
    'Montant M48 (3m)': 'Isover / Saint-Gobain',

    // Gros œuvre → BigMat
    'Sac ciment 35kg': 'BigMat',
    'IPN 200 (6m)': 'BigMat',

    // Menuiserie → Dispano
    'Bloc porte intérieur 83cm': 'Dispano',
    'Fenêtre PVC 2 vantaux 120x135': 'Dispano',

    // Isolation → Isover / Saint-Gobain
    'Laine de verre GR32 100mm (R=3.15)': 'Isover / Saint-Gobain',
    'Laine de roche soufflée (sac 12.5kg)': 'Isover / Saint-Gobain',

    // Revêtement sol → Dispano
    'Parquet flottant chêne 7mm': 'Dispano',
    'Parquet massif chêne 14mm': 'Dispano',
    'Sol PVC lame clipsable': 'Dispano',
    'Sous-couche parquet 3mm': 'Dispano',
  };

  let linkedCount = 0;
  for (const [materNom, fournNom] of Object.entries(materiauxFournisseurs)) {
    const fId = fournisseurByNom(fournNom);
    if (!fId) continue;

    const mat = await prisma.materiau.findFirst({
      where: { companyId: company.id, nom: materNom },
    });

    if (mat && !mat.fournisseurId) {
      await prisma.materiau.update({
        where: { id: mat.id },
        data: { fournisseurId: fId },
      });
      linkedCount++;
    }
  }
  console.log(`✅ ${linkedCount} matériaux liés à leurs fournisseurs`);

  // ═══════════════════════════════════════════════════════════
  // 9. Créer les compositions de prestations
  //    Lie chaque prestation à ses matériaux et services MO
  // ═══════════════════════════════════════════════════════════

  // Helper pour trouver un ID par nom
  const findPrestation = async (nom: string) =>
    prisma.prestation.findFirst({ where: { companyId: company.id, nom } });
  const findMateriau = async (nom: string) =>
    prisma.materiau.findFirst({ where: { companyId: company.id, nom } });
  const findServiceMo = async (nom: string) =>
    prisma.serviceMainOeuvre.findFirst({ where: { companyId: company.id, nom } });

  // Définition des compositions : prestation → [{ materiau?, serviceMo?, qte }]
  const compositionsData: {
    prestation: string;
    composants: { materiau?: string; serviceMo?: string; qte: number }[];
  }[] = [
    // ── Carrelage ──
    {
      prestation: 'Pose carrelage sol',
      composants: [
        { materiau: 'Carrelage grès cérame 60x60', qte: 1.05 },
        { materiau: 'Colle carrelage C2 (25kg)', qte: 0.2 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.06 },
        { serviceMo: 'Pose carrelage sol', qte: 0.2 },
      ],
    },
    {
      prestation: 'Pose carrelage mural',
      composants: [
        { materiau: 'Faïence murale 30x60', qte: 1.1 },
        { materiau: 'Colle carrelage C2 (25kg)', qte: 0.2 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.08 },
        { serviceMo: 'Pose carrelage mural', qte: 0.2 },
      ],
    },
    {
      prestation: 'Pose faïence',
      composants: [
        { materiau: 'Faïence murale 30x60', qte: 1.1 },
        { materiau: 'Colle carrelage C2 (25kg)', qte: 0.2 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.08 },
        { serviceMo: 'Pose faïence', qte: 1 },
      ],
    },
    {
      prestation: 'Ragréage sol',
      composants: [
        { materiau: 'Ragréage autolissant P3 (25kg)', qte: 0.12 },
        { serviceMo: 'Ragréage sol', qte: 1 },
      ],
    },
    {
      prestation: 'Primaire d\'accrochage',
      composants: [
        { materiau: 'Primaire d\'accrochage universel (5L)', qte: 0.15 },
        { serviceMo: 'Ragréage sol', qte: 0.2 },
      ],
    },

    // ── Peinture ──
    {
      prestation: 'Peinture mur intérieur',
      composants: [
        { materiau: 'Peinture acrylique mat 10L', qte: 0.025 },      // 0.25L/m² (2 couches)
        { materiau: 'Sous-couche universelle 10L', qte: 0.01 },
        { serviceMo: 'Peinture mur (2 couches)', qte: 1 },
      ],
    },
    {
      prestation: 'Peinture plafond',
      composants: [
        { materiau: 'Peinture acrylique mat 10L', qte: 0.025 },
        { materiau: 'Sous-couche universelle 10L', qte: 0.01 },
        { serviceMo: 'Peinture plafond (2 couches)', qte: 1 },
      ],
    },
    {
      prestation: 'Enduit décoratif',
      composants: [
        { materiau: 'Enduit de lissage (25kg)', qte: 0.16 },
        { serviceMo: 'Enduit mur', qte: 1 },
      ],
    },

    // ── Plomberie ──
    {
      prestation: 'Installation douche complète',
      composants: [
        { materiau: 'Receveur douche 80x120', qte: 1 },
        { materiau: 'Mitigeur douche thermostatique', qte: 1 },
        { materiau: 'Tube PER 16mm (couronne 100m)', qte: 6 },       // 6 ML par installation
        { serviceMo: 'Plomberie — pose sanitaire', qte: 5 },         // 5 heures
      ],
    },
    {
      prestation: 'Remplacement WC',
      composants: [
        { materiau: 'WC complet avec réservoir', qte: 1 },
        { serviceMo: 'Plomberie — pose sanitaire', qte: 3 },
      ],
    },
    {
      prestation: 'Installation lavabo',
      composants: [
        { materiau: 'Lavabo vasque 60cm', qte: 1 },
        { serviceMo: 'Plomberie — raccordement', qte: 2 },
      ],
    },
    {
      prestation: 'Remplacement chauffe-eau',
      composants: [
        { materiau: 'Chauffe-eau électrique 200L', qte: 1 },
        { serviceMo: 'Plomberie — raccordement', qte: 4 },
      ],
    },

    // ── Électricité ──
    {
      prestation: 'Pose prise électrique',
      composants: [
        { materiau: 'Prise électrique encastrée', qte: 1 },
        { materiau: 'Câble R2V 3G2.5 (100m)', qte: 5 },             // 5 ML par prise
        { serviceMo: 'Électricité — pose appareillage', qte: 1 },
      ],
    },
    {
      prestation: 'Pose interrupteur',
      composants: [
        { materiau: 'Interrupteur va-et-vient', qte: 1 },
        { materiau: 'Câble R2V 3G2.5 (100m)', qte: 4 },
        { serviceMo: 'Électricité — pose appareillage', qte: 1 },
      ],
    },
    {
      prestation: 'Pose spot encastré',
      composants: [
        { materiau: 'Spot LED encastré 7W', qte: 1 },
        { materiau: 'Câble R2V 3G2.5 (100m)', qte: 3 },
        { serviceMo: 'Électricité — pose appareillage', qte: 1 },
      ],
    },
    {
      prestation: 'Mise aux normes tableau',
      composants: [
        { materiau: 'Tableau électrique 2 rangées', qte: 1 },
        { materiau: 'Disjoncteur 20A', qte: 6 },
        { materiau: 'Câble R2V 3G2.5 (100m)', qte: 30 },
        { serviceMo: 'Électricité — câblage', qte: 8 },
      ],
    },

    // ── Maçonnerie ──
    {
      prestation: 'Montage cloison placo',
      composants: [
        { materiau: 'Plaque de plâtre BA13 (2.5x1.2m)', qte: 0.67 }, // 2 plaques / 3m²
        { materiau: 'Rail métallique R48 (3m)', qte: 0.33 },
        { materiau: 'Montant M48 (3m)', qte: 0.33 },
        { serviceMo: 'Montage cloison placo', qte: 1 },
      ],
    },
    {
      prestation: 'Démolition cloison',
      composants: [
        { serviceMo: 'Démolition cloison', qte: 1 },
      ],
    },
    {
      prestation: 'Chape béton',
      composants: [
        { materiau: 'Sac ciment 35kg', qte: 0.6 },                   // ~20kg/m²
        { serviceMo: 'Chape béton', qte: 1 },
      ],
    },
    {
      prestation: 'Ouverture mur porteur',
      composants: [
        { materiau: 'IPN 200 (6m)', qte: 1 },
        { materiau: 'Sac ciment 35kg', qte: 3 },
        { serviceMo: 'Démolition cloison', qte: 4 },                 // 4h de travail lourd
      ],
    },

    // ── Menuiserie ──
    {
      prestation: 'Pose porte intérieure',
      composants: [
        { materiau: 'Bloc porte intérieur 83cm', qte: 1 },
        { serviceMo: 'Pose porte intérieure', qte: 1 },
      ],
    },
    {
      prestation: 'Pose fenêtre PVC',
      composants: [
        { materiau: 'Fenêtre PVC 2 vantaux 120x135', qte: 1 },
        { serviceMo: 'Pose fenêtre', qte: 1 },
      ],
    },

    // ── Isolation ──
    {
      prestation: 'Isolation mur intérieur',
      composants: [
        { materiau: 'Laine de verre GR32 100mm (R=3.15)', qte: 1.05 },
        { materiau: 'Plaque de plâtre BA13 (2.5x1.2m)', qte: 0.34 },
        { serviceMo: 'Isolation laine de verre', qte: 1 },
      ],
    },
    {
      prestation: 'Isolation combles',
      composants: [
        { materiau: 'Laine de roche soufflée (sac 12.5kg)', qte: 0.8 }, // ~10kg/m²
        { serviceMo: 'Isolation combles soufflage', qte: 1 },
      ],
    },

    // ── Revêtement de sol ──
    {
      prestation: 'Pose parquet flottant',
      composants: [
        { materiau: 'Parquet flottant chêne 7mm', qte: 1.08 },
        { materiau: 'Sous-couche parquet 3mm', qte: 1.02 },
        { serviceMo: 'Pose parquet flottant', qte: 1 },
      ],
    },
    {
      prestation: 'Pose parquet massif',
      composants: [
        { materiau: 'Parquet massif chêne 14mm', qte: 1.1 },
        { serviceMo: 'Pose parquet massif', qte: 1 },
      ],
    },
    {
      prestation: 'Pose sol vinyle/PVC',
      composants: [
        { materiau: 'Sol PVC lame clipsable', qte: 1.05 },
        { serviceMo: 'Pose sol PVC', qte: 1 },
      ],
    },

    // ── Façade ──
    {
      prestation: 'Ravalement façade',
      composants: [
        { materiau: 'Enduit de lissage (25kg)', qte: 0.2 },
        { materiau: 'Peinture acrylique mat 10L', qte: 0.03 },
        { serviceMo: 'Ravalement façade', qte: 1 },
      ],
    },
    {
      prestation: 'Enduit façade',
      composants: [
        { materiau: 'Enduit de lissage (25kg)', qte: 0.2 },
        { serviceMo: 'Ravalement façade', qte: 1 },
      ],
    },

    // ── Toiture ──
    {
      prestation: 'Réparation toiture',
      composants: [
        { serviceMo: 'Couverture toiture', qte: 1 },
      ],
    },
    {
      prestation: 'Réfection toiture complète',
      composants: [
        { serviceMo: 'Couverture toiture', qte: 1.5 },
      ],
    },
    {
      prestation: 'Nettoyage toiture',
      composants: [
        { serviceMo: 'Nettoyage toiture', qte: 1 },
      ],
    },
  ];

  let compoCount = 0;
  for (const def of compositionsData) {
    const presta = await findPrestation(def.prestation);
    if (!presta) continue;

    // Supprimer les anciennes compositions pour ce ré-seed
    await prisma.prestationComposition.deleteMany({
      where: { prestationId: presta.id },
    });

    for (const comp of def.composants) {
      const matId = comp.materiau ? (await findMateriau(comp.materiau))?.id ?? null : null;
      const moId = comp.serviceMo ? (await findServiceMo(comp.serviceMo))?.id ?? null : null;

      if (!matId && !moId) continue; // skip si rien trouvé

      await prisma.prestationComposition.create({
        data: {
          prestationId: presta.id,
          materiauId: matId,
          serviceMainOeuvreId: moId,
          quantiteParUnite: comp.qte,
        },
      });
      compoCount++;
    }
  }
  console.log(`✅ ${compoCount} compositions de prestations créées`);

  // ═══════════════════════════════════════════════════════════
  // 6b. COMPOSITIONS SPÉCIFIQUES PAR CHOIX D'OPTION
  //     Certains choix modifient les matériaux utilisés
  // ═══════════════════════════════════════════════════════════

  // Exemple : Chape béton → Compositions varient selon "Type de chape"
  const chapeChoixCompositions: {
    choix: string; // ex: "Chape traditionnelle"
    composants: { materiau?: string; serviceMo?: string; qte: number }[];
  }[] = [
    {
      choix: 'Chape traditionnelle',
      composants: [
        { materiau: 'Sac ciment 35kg', qte: 0.85 }, // 30kg/m²
        { materiau: 'Sable fin (25kg)', qte: 1.3 }, // 32.5kg/m²
        { serviceMo: 'Chape béton', qte: 1 },
      ],
    },
    {
      choix: 'Chape allégée',
      composants: [
        { materiau: 'Sac ciment 35kg', qte: 0.57 }, // 20kg/m²
        { materiau: 'Polystyrène expansé (m³)', qte: 0.05 }, // Polystyrène réduit
        { materiau: 'Sable fin (25kg)', qte: 0.65 }, // 16.25kg/m²
        { serviceMo: 'Chape béton', qte: 0.8 }, // Moins de temps de MO
      ],
    },
    {
      choix: 'Chape fibrée',
      composants: [
        { materiau: 'Sac ciment 35kg', qte: 0.85 }, // 30kg/m²
        { materiau: 'Sable fin (25kg)', qte: 1.3 }, // 32.5kg/m²
        { materiau: 'Fibres de polypropylène (1kg)', qte: 0.05 }, // 50g/m²
        { serviceMo: 'Chape béton', qte: 1.1 }, // Plus de temps
      ],
    },
    {
      choix: 'Chape liquide anhydrite',
      composants: [
        { materiau: 'Anhydrite (25kg)', qte: 1.0 }, // ~25kg/m²
        { serviceMo: 'Chape béton', qte: 0.7 }, // Moins de travail
      ],
    },
  ];

  // Créer les compositions pour chaque choix de "Type de chape" → "Chape béton"
  const chapeOption = await prisma.optionPrestation.findFirst({
    where: {
      nom: 'Type de chape',
      prestation: {
        nom: 'Chape béton',
      },
    },
  });

  if (chapeOption) {
    // Supprimer anciennes compositions ChoixOptionComposition pour Chape
    await prisma.choixOptionComposition.deleteMany({
      where: {
        choixOption: {
          optionId: chapeOption.id,
        },
      },
    });

    // Créer les compositions pour chaque choix
    for (const chapeDefn of chapeChoixCompositions) {
      const choix = await prisma.choixOption.findUnique({
        where: { optionId_nom: { optionId: chapeOption.id, nom: chapeDefn.choix } },
      });

      if (choix) {
        for (const comp of chapeDefn.composants) {
          const matId = comp.materiau ? (await findMateriau(comp.materiau))?.id ?? null : null;
          const moId = comp.serviceMo ? (await findServiceMo(comp.serviceMo))?.id ?? null : null;

          if (!matId && !moId) continue;

          await prisma.choixOptionComposition.create({
            data: {
              choixOptionId: choix.id,
              materiauId: matId,
              serviceMainOeuvreId: moId,
              quantiteParUnite: comp.qte,
            },
          });
        }
      }
    }
    console.log(`✅ Compositions spécifiques créées pour les choix de "Type de chape"`);
  }

  // ── Configuration : Montage cloison placo ──
  const montageCloisonOptions: Record<string, string[]> = {
    'Type de placo': ['BA13 standard', 'BA13 hydrofuge', 'BA13 phonique', 'BA13 feu (rose)', 'Double parement'],
  };

  const montageCloisonCompositions: Record<string, { choix: string; composants: { materiau?: string; serviceMo?: string; qte: number }[] }> = {
    'BA13 standard': {
      choix: 'BA13 standard',
      composants: [
        { materiau: 'Plaque de plâtre BA13 (2.5x1.2m)', qte: 0.67 },
        { materiau: 'Rail métallique R48 (3m)', qte: 0.33 },
        { materiau: 'Montant M48 (3m)', qte: 0.33 },
        { serviceMo: 'Montage cloison placo', qte: 1 },
      ],
    },
    'BA13 hydrofuge': {
      choix: 'BA13 hydrofuge',
      composants: [
        { materiau: 'Plaque de plâtre BA13 (2.5x1.2m)', qte: 0.67 },
        { materiau: 'Rail métallique R48 (3m)', qte: 0.33 },
        { materiau: 'Montant M48 (3m)', qte: 0.33 },
        { serviceMo: 'Montage cloison placo', qte: 1.1 },
      ],
    },
    'BA13 phonique': {
      choix: 'BA13 phonique',
      composants: [
        { materiau: 'Plaque de plâtre BA13 (2.5x1.2m)', qte: 0.67 },
        { materiau: 'Laine de roche soufflée (sac 12.5kg)', qte: 0.4 },
        { materiau: 'Rail métallique R48 (3m)', qte: 0.33 },
        { materiau: 'Montant M48 (3m)', qte: 0.33 },
        { serviceMo: 'Montage cloison placo', qte: 1.15 },
      ],
    },
    'BA13 feu (rose)': {
      choix: 'BA13 feu (rose)',
      composants: [
        { materiau: 'Plaque de plâtre BA13 (2.5x1.2m)', qte: 0.67 },
        { materiau: 'Rail métallique R48 (3m)', qte: 0.33 },
        { materiau: 'Montant M48 (3m)', qte: 0.33 },
        { serviceMo: 'Montage cloison placo', qte: 1.05 },
      ],
    },
    'Double parement': {
      choix: 'Double parement',
      composants: [
        { materiau: 'Plaque de plâtre BA13 (2.5x1.2m)', qte: 1.34 },
        { materiau: 'Rail métallique R48 (3m)', qte: 0.33 },
        { materiau: 'Montant M48 (3m)', qte: 0.33 },
        { serviceMo: 'Montage cloison placo', qte: 1.3 },
      ],
    },
  };

  // Appliquer compositions pour Montage cloison placo
  const cloisPlacOption = await prisma.optionPrestation.findFirst({
    where: {
      nom: 'Type de placo',
      prestation: { nom: 'Montage cloison placo' },
    },
  });

  if (cloisPlacOption) {
    await prisma.choixOptionComposition.deleteMany({
      where: { choixOption: { optionId: cloisPlacOption.id } },
    });

    for (const choixName of montageCloisonOptions['Type de placo']) {
      const choixDef = montageCloisonCompositions[choixName];
      if (!choixDef) continue;
      const choix = await prisma.choixOption.findUnique({
        where: { optionId_nom: { optionId: cloisPlacOption.id, nom: choixName } },
      });

      if (choix) {
        for (const comp of choixDef.composants) {
          const matId = comp.materiau ? (await findMateriau(comp.materiau))?.id ?? null : null;
          const moId = comp.serviceMo ? (await findServiceMo(comp.serviceMo))?.id ?? null : null;
          if ((matId || moId) && comp.qte > 0) {
            await prisma.choixOptionComposition.create({
              data: { choixOptionId: choix.id, materiauId: matId, serviceMainOeuvreId: moId, quantiteParUnite: comp.qte },
            });
          }
        }
      }
    }
    console.log(`✅ Compositions enrichies pour "Montage cloison placo"`);
  }

  // ── Configuration : Isolation mur intérieur ──
  const isolMurCompositions: Record<string, { choix: string; composants: { materiau?: string; serviceMo?: string; qte: number }[] }> = {
    'Laine de verre': {
      choix: 'Laine de verre',
      composants: [
        { materiau: 'Laine de verre GR32 100mm (R=3.15)', qte: 1.05 },
        { materiau: 'Plaque de plâtre BA13 (2.5x1.2m)', qte: 0.34 },
        { serviceMo: 'Isolation laine de verre', qte: 1 },
      ],
    },
    'Laine de roche': {
      choix: 'Laine de roche',
      composants: [
        { materiau: 'Laine de roche soufflée (sac 12.5kg)', qte: 0.8 },
        { materiau: 'Plaque de plâtre BA13 (2.5x1.2m)', qte: 0.34 },
        { serviceMo: 'Isolation laine de verre', qte: 1.1 },
      ],
    },
    'Polystyrène expansé': {
      choix: 'Polystyrène expansé',
      composants: [
        { materiau: 'Polystyrène expansé (m³)', qte: 0.1 },
        { materiau: 'Plaque de plâtre BA13 (2.5x1.2m)', qte: 0.34 },
        { serviceMo: 'Isolation laine de verre', qte: 0.9 },
      ],
    },
    'Polyuréthane': {
      choix: 'Polyuréthane',
      composants: [
        { materiau: 'Plaque de plâtre BA13 (2.5x1.2m)', qte: 0.34 },
        { serviceMo: 'Isolation laine de verre', qte: 1.15 },
      ],
    },
    'Fibre de bois': {
      choix: 'Fibre de bois',
      composants: [
        { materiau: 'Plaque de plâtre BA13 (2.5x1.2m)', qte: 0.34 },
        { serviceMo: 'Isolation laine de verre', qte: 1.2 },
      ],
    },
  };

  const isolMurOption = await prisma.optionPrestation.findFirst({
    where: {
      nom: 'Type d\'isolant',
      prestation: { nom: 'Isolation mur intérieur' },
    },
  });

  if (isolMurOption) {
    await prisma.choixOptionComposition.deleteMany({
      where: { choixOption: { optionId: isolMurOption.id } },
    });

    for (const [choixName, choixDef] of Object.entries(isolMurCompositions)) {
      const choix = await prisma.choixOption.findUnique({
        where: { optionId_nom: { optionId: isolMurOption.id, nom: choixName } },
      });

      if (choix) {
        for (const comp of choixDef.composants) {
          const matId = comp.materiau ? (await findMateriau(comp.materiau))?.id ?? null : null;
          const moId = comp.serviceMo ? (await findServiceMo(comp.serviceMo))?.id ?? null : null;
          if ((matId || moId) && comp.qte > 0) {
            await prisma.choixOptionComposition.create({
              data: { choixOptionId: choix.id, materiauId: matId, serviceMainOeuvreId: moId, quantiteParUnite: comp.qte },
            });
          }
        }
      }
    }
    console.log(`✅ Compositions enrichies pour "Isolation mur intérieur"`);
  }

  // ── Configuration : Pose carrelage sol (format) ──
  const carrelageCompositions: Record<string, { choix: string; composants: { materiau?: string; serviceMo?: string; qte: number }[] }> = {
    '20x20 cm': {
      choix: '20x20 cm',
      composants: [
        { materiau: 'Carrelage grès cérame 20x20', qte: 1.07 },
        { materiau: 'Colle carrelage C2 (25kg)', qte: 0.22 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.02 },
        { serviceMo: 'Pose carrelage sol', qte: 0.24 },
      ],
    },
    '30x30 cm': {
      choix: '30x30 cm',
      composants: [
        { materiau: 'Carrelage grès cérame 30x30', qte: 1.06 },
        { materiau: 'Colle carrelage C2 (25kg)', qte: 0.21 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.016 },
        { serviceMo: 'Pose carrelage sol', qte: 0.22 },
      ],
    },
    '45x45 cm': {
      choix: '45x45 cm',
      composants: [
        { materiau: 'Carrelage grès cérame 45x45', qte: 1.05 },
        { materiau: 'Colle carrelage C2 (25kg)', qte: 0.205 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.013 },
        { serviceMo: 'Pose carrelage sol', qte: 0.21 },
      ],
    },
    '60x60 cm': {
      choix: '60x60 cm',
      composants: [
        { materiau: 'Carrelage grès cérame 60x60', qte: 1.05 },
        { materiau: 'Colle carrelage C2 (25kg)', qte: 0.2 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.012 },
        { serviceMo: 'Pose carrelage sol', qte: 0.2 },
      ],
    },
    '30x60 cm': {
      choix: '30x60 cm',
      composants: [
        { materiau: 'Carrelage grès cérame 30x60', qte: 1.05 },
        { materiau: 'Colle carrelage C2 (25kg)', qte: 0.195 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.012 },
        { serviceMo: 'Pose carrelage sol', qte: 0.205 },
      ],
    },
    '120x60 cm': {
      choix: '120x60 cm',
      composants: [
        { materiau: 'Carrelage grès cérame 120x60', qte: 1.08 },
        { materiau: 'Colle carrelage C2S1 (25kg)', qte: 0.24 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.014 },
        { serviceMo: 'Pose carrelage sol', qte: 0.26 },
      ],
    },
    '120x120 cm': {
      choix: '120x120 cm',
      composants: [
        { materiau: 'Carrelage grès cérame 120x120', qte: 1.1 },
        { materiau: 'Colle carrelage C2S2 (25kg)', qte: 0.28 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.018 },
        { serviceMo: 'Pose carrelage sol', qte: 0.32 },
      ],
    },
  };

  const carrelageOption = await prisma.optionPrestation.findFirst({
    where: {
      nom: 'Format',
      prestation: { nom: 'Pose carrelage sol' },
    },
  });

  if (carrelageOption) {
    await prisma.choixOptionComposition.deleteMany({
      where: { choixOption: { optionId: carrelageOption.id } },
    });

    for (const [choixName, choixDef] of Object.entries(carrelageCompositions)) {
      const choix = await prisma.choixOption.findUnique({
        where: { optionId_nom: { optionId: carrelageOption.id, nom: choixName } },
      });

      if (choix) {
        for (const comp of choixDef.composants) {
          const matId = comp.materiau ? (await findMateriau(comp.materiau))?.id ?? null : null;
          const moId = comp.serviceMo ? (await findServiceMo(comp.serviceMo))?.id ?? null : null;
          if ((matId || moId) && comp.qte > 0) {
            await prisma.choixOptionComposition.create({
              data: {
                choixOptionId: choix.id,
                materiauId: matId,
                serviceMainOeuvreId: moId,
                quantiteParUnite: comp.qte,
              },
            });
          }
        }
      }
    }
    console.log(`✅ Compositions enrichies pour "Pose carrelage sol"`);
  }

  // ── Configuration : Pose carrelage mural (format) ──
  const carrelageMuralCompositions: Record<string, { choix: string; composants: { materiau?: string; serviceMo?: string; qte: number }[] }> = {
    '10x10 cm': {
      choix: '10x10 cm',
      composants: [
        { materiau: 'Carrelage mural 10x10', qte: 1.1 },
        { materiau: 'Colle carrelage C2 (25kg)', qte: 0.24 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.03 },
        { serviceMo: 'Pose carrelage mural', qte: 0.3 },
      ],
    },
    '10x20 cm (métro)': {
      choix: '10x20 cm (métro)',
      composants: [
        { materiau: 'Carrelage métro 10x20', qte: 1.08 },
        { materiau: 'Colle carrelage C2 (25kg)', qte: 0.23 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.025 },
        { serviceMo: 'Pose carrelage mural', qte: 0.26 },
      ],
    },
    '20x20 cm': {
      choix: '20x20 cm',
      composants: [
        { materiau: 'Carrelage mural 20x20', qte: 1.08 },
        { materiau: 'Colle carrelage C2 (25kg)', qte: 0.22 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.02 },
        { serviceMo: 'Pose carrelage mural', qte: 0.23 },
      ],
    },
    '30x60 cm': {
      choix: '30x60 cm',
      composants: [
        { materiau: 'Faïence murale 30x60', qte: 1.08 },
        { materiau: 'Colle carrelage C2 (25kg)', qte: 0.2 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.016 },
        { serviceMo: 'Pose carrelage mural', qte: 0.2 },
      ],
    },
    '25x75 cm': {
      choix: '25x75 cm',
      composants: [
        { materiau: 'Carrelage mural 25x75', qte: 1.1 },
        { materiau: 'Colle carrelage C2S1 (25kg)', qte: 0.24 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.018 },
        { serviceMo: 'Pose carrelage mural', qte: 0.28 },
      ],
    },
    'Grand format > 60cm': {
      choix: 'Grand format > 60cm',
      composants: [
        { materiau: 'Carrelage grès cérame 120x60', qte: 1.12 },
        { materiau: 'Colle carrelage C2S2 (25kg)', qte: 0.27 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.02 },
        { serviceMo: 'Pose carrelage mural', qte: 0.32 },
      ],
    },
  };

  const carrelageMuralOption = await prisma.optionPrestation.findFirst({
    where: {
      nom: 'Format',
      prestation: { nom: 'Pose carrelage mural' },
    },
  });

  if (carrelageMuralOption) {
    await prisma.choixOptionComposition.deleteMany({
      where: { choixOption: { optionId: carrelageMuralOption.id } },
    });

    for (const [choixName, choixDef] of Object.entries(carrelageMuralCompositions)) {
      const choix = await prisma.choixOption.findUnique({
        where: { optionId_nom: { optionId: carrelageMuralOption.id, nom: choixName } },
      });

      if (choix) {
        for (const comp of choixDef.composants) {
          const matId = comp.materiau ? (await findMateriau(comp.materiau))?.id ?? null : null;
          const moId = comp.serviceMo ? (await findServiceMo(comp.serviceMo))?.id ?? null : null;
          if ((matId || moId) && comp.qte > 0) {
            await prisma.choixOptionComposition.create({
              data: {
                choixOptionId: choix.id,
                materiauId: matId,
                serviceMainOeuvreId: moId,
                quantiteParUnite: comp.qte,
              },
            });
          }
        }
      }
    }
    console.log(`✅ Compositions enrichies pour "Pose carrelage mural"`);
  }

  // ── Configuration : Pose faïence (type) ──
  const faienceTypeCompositions: Record<string, { choix: string; composants: { materiau?: string; serviceMo?: string; qte: number }[] }> = {
    'Faïence classique': {
      choix: 'Faïence classique',
      composants: [
        { materiau: 'Faïence murale 30x60', qte: 1.1 },
        { materiau: 'Colle carrelage C2 (25kg)', qte: 0.2 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.08 },
        { serviceMo: 'Pose faïence', qte: 1 },
      ],
    },
    'Carreaux métro': {
      choix: 'Carreaux métro',
      composants: [
        { materiau: 'Carrelage métro 10x20', qte: 1.1 },
        { materiau: 'Colle carrelage C2 (25kg)', qte: 0.22 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.1 },
        { serviceMo: 'Pose faïence', qte: 1.12 },
      ],
    },
    Zellige: {
      choix: 'Zellige',
      composants: [
        { materiau: 'Zellige artisanal 10x10', qte: 1.15 },
        { materiau: 'Colle carrelage C2S1 (25kg)', qte: 0.24 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.11 },
        { serviceMo: 'Pose faïence', qte: 1.35 },
      ],
    },
    'Mosaïque': {
      choix: 'Mosaïque',
      composants: [
        { materiau: 'Mosaïque pâte de verre 2x2', qte: 1.12 },
        { materiau: 'Colle carrelage C2S1 (25kg)', qte: 0.26 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.12 },
        { serviceMo: 'Pose faïence', qte: 1.4 },
      ],
    },
    'Carreaux de ciment': {
      choix: 'Carreaux de ciment',
      composants: [
        { materiau: 'Carreaux de ciment 20x20', qte: 1.1 },
        { materiau: 'Colle carrelage C2S2 (25kg)', qte: 0.28 },
        { materiau: 'Joint carrelage (5kg)', qte: 0.11 },
        { serviceMo: 'Pose faïence', qte: 1.25 },
      ],
    },
  };

  const faienceTypeOption = await prisma.optionPrestation.findFirst({
    where: {
      nom: 'Type',
      prestation: { nom: 'Pose faïence' },
    },
  });

  if (faienceTypeOption) {
    await prisma.choixOptionComposition.deleteMany({
      where: { choixOption: { optionId: faienceTypeOption.id } },
    });

    for (const [choixName, choixDef] of Object.entries(faienceTypeCompositions)) {
      const choix = await prisma.choixOption.findUnique({
        where: { optionId_nom: { optionId: faienceTypeOption.id, nom: choixName } },
      });

      if (choix) {
        for (const comp of choixDef.composants) {
          const matId = comp.materiau ? (await findMateriau(comp.materiau))?.id ?? null : null;
          const moId = comp.serviceMo ? (await findServiceMo(comp.serviceMo))?.id ?? null : null;
          if ((matId || moId) && comp.qte > 0) {
            await prisma.choixOptionComposition.create({
              data: {
                choixOptionId: choix.id,
                materiauId: matId,
                serviceMainOeuvreId: moId,
                quantiteParUnite: comp.qte,
              },
            });
          }
        }
      }
    }
    console.log(`✅ Compositions enrichies pour "Pose faïence"`);
  }

  // ── Configuration : Ragréage sol (type de ragréage) ──
  const ragrageTypeCompositions: Record<string, { choix: string; composants: { materiau?: string; serviceMo?: string; qte: number }[] }> = {
    'Autolissant standard (P3)': {
      choix: 'Autolissant standard (P3)',
      composants: [
        { materiau: 'Ragréage autolissant P3 (25kg)', qte: 0.12 },
        { serviceMo: 'Ragréage sol', qte: 1 },
      ],
    },
    'Autolissant renforcé (P4)': {
      choix: 'Autolissant renforcé (P4)',
      composants: [
        { materiau: 'Ragréage autolissant P4 (25kg)', qte: 0.13 },
        { serviceMo: 'Ragréage sol', qte: 1.05 },
      ],
    },
    'Fibré haute résistance': {
      choix: 'Fibré haute résistance',
      composants: [
        { materiau: 'Ragréage fibré haute résistance (25kg)', qte: 0.14 },
        { serviceMo: 'Ragréage sol', qte: 1.1 },
      ],
    },
  };

  const ragrageTypeOption = await prisma.optionPrestation.findFirst({
    where: {
      nom: 'Type de ragréage',
      prestation: { nom: 'Ragréage sol' },
    },
  });

  if (ragrageTypeOption) {
    await prisma.choixOptionComposition.deleteMany({
      where: { choixOption: { optionId: ragrageTypeOption.id } },
    });

    for (const [choixName, choixDef] of Object.entries(ragrageTypeCompositions)) {
      const choix = await prisma.choixOption.findUnique({
        where: { optionId_nom: { optionId: ragrageTypeOption.id, nom: choixName } },
      });

      if (choix) {
        for (const comp of choixDef.composants) {
          const matId = comp.materiau ? (await findMateriau(comp.materiau))?.id ?? null : null;
          const moId = comp.serviceMo ? (await findServiceMo(comp.serviceMo))?.id ?? null : null;
          if ((matId || moId) && comp.qte > 0) {
            await prisma.choixOptionComposition.create({
              data: {
                choixOptionId: choix.id,
                materiauId: matId,
                serviceMainOeuvreId: moId,
                quantiteParUnite: comp.qte,
              },
            });
          }
        }
      }
    }
    console.log(`✅ Compositions enrichies pour "Ragréage sol"`);
  }


  console.log('ℹ️ Seed diagnostic (questions/informations requises) retiré de ce schéma.');

  console.log('\n🎉 Seed terminé avec succès !');
  console.log('\n📋 Identifiants de connexion :');
  console.log('   Email    : admin@batiment-pro.fr');
  console.log('   Password : Admin@2026!');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
