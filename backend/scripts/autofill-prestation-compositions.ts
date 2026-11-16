import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

function normalize(text: unknown): string {
  return (text ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenize(text: unknown): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3);
}

function scoreMatch(haystackTokens: string[], candidateLabel: string): number {
  const candidateTokens = tokenize(candidateLabel);
  const set = new Set(haystackTokens);
  let score = 0;

  for (const token of candidateTokens) {
    if (set.has(token)) score += 1;
  }

  return score;
}

function estimateMaterialQty(unite: string, prestationName: string): number {
  const name = normalize(prestationName);

  if (name.includes('peinture') && unite === 'M2') return 0.12;
  if (name.includes('carrel') && unite === 'M2') return 1.05;
  if (name.includes('enduit') && unite === 'M2') return 1.1;
  if (name.includes('isolation') && unite === 'M2') return 1;

  if (['M2', 'ML', 'M3', 'PIECE', 'FORFAIT'].includes(unite)) return 1;
  return 1;
}

function estimateServiceQty(unite: string, prestationName: string): number {
  const name = normalize(prestationName);

  if (name.includes('diagnostic') || name.includes('etude') || name.includes('visite')) {
    return 1;
  }

  if (unite === 'M2') return 0.2;
  if (unite === 'ML') return 0.15;
  if (unite === 'M3') return 0.3;
  if (unite === 'PIECE') return 0.5;
  if (unite === 'FORFAIT') return 1;

  return 0.5;
}

function shouldUseMaterialOnly(prestationName: string): boolean {
  const name = normalize(prestationName);
  return name.includes('fourniture') || name.includes('livraison');
}

function shouldUseServiceOnly(prestationName: string): boolean {
  const name = normalize(prestationName);
  return (
    name.includes('diagnostic') ||
    name.includes('etude') ||
    name.includes('visite') ||
    name.includes('controle')
  );
}

function pickBestCandidate<T>(
  contextTokens: string[],
  items: T[],
  label: (item: T) => string,
  fallbackSort: (a: T, b: T) => number,
): T | null {
  let best: T | null = null;
  let bestScore = -1;

  for (const item of items) {
    const score = scoreMatch(contextTokens, label(item));
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  if (best && bestScore > 0) return best;

  const sorted = [...items].sort(fallbackSort);
  return sorted[0] ?? null;
}

async function main() {
  const apply = process.argv.includes('--apply');

  const [materiaux, services, prestations] = await Promise.all([
    prisma.materiau.findMany({
      where: { actif: true },
      select: { id: true, nom: true, prixAchatFixe: true, unite: true },
    }),
    prisma.serviceMainOeuvre.findMany({
      where: { actif: true },
      select: { id: true, nom: true, prixUnitaire: true, unite: true },
    }),
    prisma.prestation.findMany({
      where: {
        actif: true,
        compositions: { none: {} },
      },
      select: {
        id: true,
        nom: true,
        unite: true,
        categorie: { select: { nom: true } },
        sousCategorie: { select: { nom: true } },
      },
      orderBy: { id: 'asc' },
    }),
  ]);

  if (materiaux.length === 0 && services.length === 0) {
    console.log('Aucun materiau/service actif disponible.');
    return;
  }

  const plans = prestations.map((prestation) => {
    const contextText = `${prestation.nom} ${prestation.categorie?.nom ?? ''} ${prestation.sousCategorie?.nom ?? ''}`;
    const contextTokens = tokenize(contextText);

    const bestMateriau = materiaux.length
      ? pickBestCandidate(
          contextTokens,
          materiaux,
          (m) => m.nom,
          (a, b) => a.prixAchatFixe - b.prixAchatFixe,
        )
      : null;

    const bestService = services.length
      ? pickBestCandidate(
          contextTokens,
          services,
          (s) => s.nom,
          (a, b) => a.prixUnitaire - b.prixUnitaire,
        )
      : null;

    const serviceOnly = shouldUseServiceOnly(prestation.nom);
    const materialOnly = shouldUseMaterialOnly(prestation.nom);

    const entries: Array<{
      prestationId: number;
      materiauId: number | null;
      serviceMainOeuvreId: number | null;
      quantiteParUnite: number;
    }> = [];

    if (!serviceOnly && bestMateriau) {
      entries.push({
        prestationId: prestation.id,
        materiauId: bestMateriau.id,
        serviceMainOeuvreId: null,
        quantiteParUnite: estimateMaterialQty(prestation.unite, prestation.nom),
      });
    }

    if (!materialOnly && bestService) {
      entries.push({
        prestationId: prestation.id,
        materiauId: null,
        serviceMainOeuvreId: bestService.id,
        quantiteParUnite: estimateServiceQty(prestation.unite, prestation.nom),
      });
    }

    if (entries.length === 0) {
      if (bestMateriau) {
        entries.push({
          prestationId: prestation.id,
          materiauId: bestMateriau.id,
          serviceMainOeuvreId: null,
          quantiteParUnite: 1,
        });
      } else if (bestService) {
        entries.push({
          prestationId: prestation.id,
          materiauId: null,
          serviceMainOeuvreId: bestService.id,
          quantiteParUnite: 1,
        });
      }
    }

    return {
      prestation,
      bestMateriau,
      bestService,
      entries,
    };
  });

  const totalEntries = plans.reduce((sum, p) => sum + p.entries.length, 0);

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'APPLY' : 'DRY_RUN',
        prestationsSansComposition: prestations.length,
        compositionsPrevues: totalEntries,
        apercu: plans.slice(0, 25).map((p) => ({
          prestationId: p.prestation.id,
          prestationNom: p.prestation.nom,
          unite: p.prestation.unite,
          categorie: p.prestation.categorie?.nom ?? null,
          sousCategorie: p.prestation.sousCategorie?.nom ?? null,
          materiauChoisi: p.bestMateriau ? { id: p.bestMateriau.id, nom: p.bestMateriau.nom } : null,
          serviceChoisi: p.bestService ? { id: p.bestService.id, nom: p.bestService.nom } : null,
          entries: p.entries,
        })),
      },
      null,
      2,
    ),
  );

  if (!apply) return;

  let inserted = 0;
  for (const plan of plans) {
    for (const entry of plan.entries) {
      await prisma.prestationComposition.create({ data: entry });
      inserted += 1;
    }
  }

  const remaining = await prisma.prestation.count({
    where: {
      actif: true,
      compositions: { none: {} },
    },
  });

  console.log(JSON.stringify({ inserted, remainingSansComposition: remaining }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
