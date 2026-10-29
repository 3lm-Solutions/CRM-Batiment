import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { AuthUser } from '../../../common';
import { type LeadSource, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DemandesDevisService } from '../../commercial/demandes-devis/demandes-devis.service';
import { DevisLifecycleService } from '../../commercial/devis/devis-lifecycle.service';
import { DevisLignesService } from '../../commercial/devis/devis-lignes.service';
import { ChantiersService } from '../../execution/chantiers/chantiers.service';
import { ClientsService } from '../../referentiel/clients/clients.service';
import { DEMO_SIGNATURE_PNG } from './demo-signature';

interface ClientExemple {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresseChantier: string;
  source: LeadSource;
}

/** Fictitious clients — example.com addresses (reserved domain: no real mailbox). */
const CLIENTS: ClientExemple[] = [
  {
    nom: 'Martin',
    prenom: 'Sophie',
    email: 'sophie.martin@example.com',
    telephone: '06 12 34 56 01',
    adresseChantier: '12 rue des Lilas, 69003 Lyon',
    source: 'SITE_WEB',
  },
  {
    nom: 'Roux',
    prenom: 'Léa',
    email: 'lea.roux@example.com',
    telephone: '06 12 34 56 02',
    adresseChantier: '4 place Bellecour, 69002 Lyon',
    source: 'RECOMMANDATION',
  },
  {
    nom: 'Bernard',
    prenom: 'Paul',
    email: 'paul.bernard@example.com',
    telephone: '06 12 34 56 03',
    adresseChantier: '8 chemin des Vignes, 69130 Écully',
    source: 'APPEL',
  },
  {
    nom: 'Petit',
    prenom: 'Hugo',
    email: 'hugo.petit@example.com',
    telephone: '06 12 34 56 04',
    adresseChantier: '27 cours Vitton, 69006 Lyon',
    source: 'SITE_WEB',
  },
  {
    nom: 'Garnier',
    prenom: 'Thomas',
    email: 'thomas.garnier@example.com',
    telephone: '06 12 34 56 05',
    adresseChantier: '3 rue Pasteur, 69300 Caluire',
    source: 'APPEL',
  },
  {
    nom: 'Fontaine',
    prenom: 'Claire',
    email: 'claire.fontaine@example.com',
    telephone: '06 12 34 56 06',
    adresseChantier: '15 avenue Foch, 69110 Sainte-Foy',
    source: 'RECOMMANDATION',
  },
];

type Etape = 'demande' | 'demande-en-cours' | 'brouillon' | 'envoye' | 'signe' | 'signe-en-cours';

/** One project per client, each stopped at a different stage of the workflow. */
const PROJETS: { client: number; description: string; lignes: [string, number][]; etape: Etape }[] =
  [
    {
      client: 0,
      description:
        'Rénovation complète de la salle de bain (8 m²) : remplacement de la baignoire par une douche à l’italienne, faïence murale et carrelage au sol.',
      lignes: [
        ['Dépose sanitaires', 3],
        ['Installation douche complète', 1],
        ['Pose faïence', 18],
        ['Pose carrelage sol', 8],
      ],
      etape: 'signe-en-cours',
    },
    {
      client: 1,
      description: 'Cuisine : pose d’une cuisine équipée de 4 ml avec plan de travail et crédence.',
      lignes: [
        ['Pose cuisine équipée', 4],
        ['Pose plan de travail', 4],
        ['Pose crédence cuisine', 3],
      ],
      etape: 'signe',
    },
    {
      client: 2,
      description: 'Isolation des combles perdus (60 m²) par soufflage.',
      lignes: [['Isolation combles soufflage', 60]],
      etape: 'envoye',
    },
    {
      client: 3,
      description: 'Peinture du salon : murs (45 m²) et plafond (25 m²), préparation des supports.',
      lignes: [
        ['Préparation murs', 45],
        ['Peinture mur intérieur', 45],
        ['Peinture plafond', 25],
      ],
      etape: 'brouillon',
    },
    {
      client: 4,
      description: 'Remplacement de la chaudière gaz et pose de 3 radiateurs dans les chambres.',
      lignes: [],
      etape: 'demande-en-cours',
    },
    {
      client: 5,
      description: 'Pose de parquet flottant dans deux chambres (28 m² au total).',
      lignes: [],
      etape: 'demande',
    },
  ];

/** Marker: the scenario is loaded once per company. */
const MARQUEUR = CLIENTS[0].email;

const sha256 = (v: string) => createHash('sha256').update(v).digest('base64url');

/**
 * Step 15 — sample data of the demo sandbox (also `pnpm demo:exemples` in development).
 * Built THROUGH the real services (quote → signature → job site + deposit + supplier orders),
 * so the demo shows exactly what the application does. Each project is independent: one
 * failing (e.g. a prestation renamed in the catalogue) does not stop the others.
 */
@Injectable()
export class DemoScenario {
  private readonly logger = new Logger(DemoScenario.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
    private readonly demandes: DemandesDevisService,
    private readonly lignes: DevisLignesService,
    private readonly lifecycle: DevisLifecycleService,
    private readonly chantiers: ChantiersService,
  ) {}

  async load(companyId: number): Promise<string[]> {
    if (await this.prisma.client.count({ where: { companyId, email: MARQUEUR } })) {
      return ['Données d’exemple déjà présentes : rien à faire.'];
    }
    const admin = await this.user(companyId, Role.ADMIN);
    const technico = (await this.user(companyId, Role.TECHNICO)) ?? admin;
    const assistante = (await this.user(companyId, Role.ASSISTANTE)) ?? admin;
    const chef = await this.user(companyId, Role.CHEF_CHANTIER);
    if (!admin || !technico || !assistante)
      return ['Aucun compte ADMIN dans l’entreprise : lancez d’abord pnpm db:seed.'];

    // The advisors sign quotes with the signature of their profile
    await this.prisma.user.updateMany({
      where: { id: { in: [admin.id, technico.id] }, signatureBase64: null },
      data: { signatureBase64: DEMO_SIGNATURE_PNG, signatureUpdatedAt: new Date() },
    });

    const prestations = new Map<string, number>(
      (
        await this.prisma.prestation.findMany({
          where: { companyId, actif: true },
          select: { id: true, nom: true },
        })
      ).map((p) => [p.nom, p.id] as const),
    );
    const resume: string[] = [];
    const clientIds: number[] = [];

    for (const c of CLIENTS) {
      const client = await this.clients.create(assistante, {
        ...c,
        adresseClient: c.adresseChantier,
      });
      clientIds.push(client.id);
    }
    resume.push(`${CLIENTS.length} clients`);

    for (const projet of PROJETS) {
      const client = CLIENTS[projet.client];
      try {
        const demande = await this.demandes.create(assistante, {
          clientId: clientIds[projet.client],
          description: projet.description,
          source: client.source,
        });
        if (projet.etape === 'demande') continue;
        if (projet.etape === 'demande-en-cours') {
          await this.demandes.changerStatut(assistante, demande.id, 'EN_COURS');
          continue;
        }

        await this.demandes.changerStatut(assistante, demande.id, 'QUALIFIE');
        const devis = await this.demandes.convertirEnDevis(technico, demande.id);
        const lignes = projet.lignes
          .filter(([nom]) => prestations.has(nom))
          .map(([nom, quantite]) => ({ prestationId: prestations.get(nom)!, quantite }));
        if (lignes.length) await this.lignes.addMany(technico, devis.id, lignes);
        if (projet.etape === 'brouillon') continue;

        await this.lifecycle.envoyer(technico, devis.id);
        if (projet.etape === 'envoye') continue;

        // Verbal agreement → SIGNE: the workflow creates the job site, the deposit invoice
        // and the supplier orders, exactly as in production
        await this.lifecycle.signerConseiller(technico, devis.id, { verbal: true });
        if (projet.etape === 'signe-en-cours') {
          const { chantierId } = await this.prisma.devis.findUniqueOrThrow({
            where: { id: devis.id },
            select: { chantierId: true },
          });
          if (chantierId) {
            if (chef) await this.chantiers.update(admin, chantierId, { chefChantierId: chef.id });
            await this.chantiers.transition(admin, chantierId, 'EN_COURS');
            // 26/10: during the works the client writes from his space (the SAV opens at the end
            // of the works) — an open alert to answer in « Retours client »
            await this.prisma.retourClient.create({
              data: {
                companyId,
                clientId: clientIds[projet.client],
                chantierId,
                type: 'ALERTE',
                message:
                  'Le joint silicone en bas de la paroi de douche me semble mal fini, pouvez-vous regarder ?',
              },
            });
          }
        }
      } catch (error) {
        this.logger.warn(
          `Exemple « ${client.prenom} ${client.nom} » ignoré : ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    resume.push(
      `${PROJETS.length} demandes, ${PROJETS.filter((p) => p.lignes.length).length} devis (brouillon, envoyé, 2 signés → chantiers et acomptes), 1 alerte client`,
    );

    await this.prospects(companyId);
    resume.push('2 conversations du chatbot (Assistant IA)');
    return resume;
  }

  /** Two chatbot conversations, one ready to qualify. */
  private async prospects(companyId: number) {
    const now = Date.now();
    const at = (minutes: number) => new Date(now - minutes * 60_000);
    await this.prisma.chatSession.create({
      data: {
        companyId,
        tokenHash: sha256(randomBytes(32).toString('base64url')),
        statut: 'A_QUALIFIER',
        clientNom: 'Lefèvre',
        clientPrenom: 'Julie',
        clientEmail: 'julie.lefevre@example.com',
        clientTelephone: '06 44 55 66 77',
        adresse: 'Villeurbanne',
        typeProjet: 'Rénovation salle de bain',
        description:
          'Salle d’eau de 5 m² à rénover : douche à la place de la baignoire, nouveau carrelage.',
        delai: 'Avant l’été',
        derniereActivite: at(30),
        createdAt: at(40),
        messages: {
          create: [
            {
              role: 'assistant',
              contenu: 'Bonjour ! Décrivez-moi votre projet : je prépare votre demande de devis.',
              createdAt: at(40),
            },
            {
              role: 'user',
              contenu:
                'Bonjour, je voudrais remplacer ma baignoire par une douche, la pièce fait 5 m².',
              createdAt: at(39),
            },
            {
              role: 'assistant',
              contenu:
                'Très bon projet ! Pour qu’un conseiller vous rappelle, pouvez-vous me donner votre nom et un téléphone ?',
              createdAt: at(39),
            },
            {
              role: 'user',
              contenu:
                'Julie Lefèvre, 06 44 55 66 77, j’habite à Villeurbanne. Idéalement avant l’été.',
              createdAt: at(31),
            },
            {
              role: 'assistant',
              contenu:
                'Merci Julie ! Votre demande est enregistrée : un conseiller vous rappelle sous 48 h ouvrées.',
              createdAt: at(30),
            },
          ],
        },
      },
    });
    await this.prisma.chatSession.create({
      data: {
        companyId,
        tokenHash: sha256(randomBytes(32).toString('base64url')),
        statut: 'NOUVEAU',
        derniereActivite: at(5),
        createdAt: at(6),
        messages: {
          create: [
            {
              role: 'assistant',
              contenu: 'Bonjour ! Décrivez-moi votre projet : je prépare votre demande de devis.',
              createdAt: at(6),
            },
            { role: 'user', contenu: 'Vous intervenez à Vienne ?', createdAt: at(5) },
          ],
        },
      },
    });
  }

  private async user(companyId: number, role: Role): Promise<AuthUser | null> {
    const u = await this.prisma.user.findFirst({
      where: { companyId, role, actif: true },
      orderBy: { id: 'asc' },
    });
    return u ? { id: u.id, email: u.email, role: u.role, companyId, scope: 'session' } : null;
  }
}
