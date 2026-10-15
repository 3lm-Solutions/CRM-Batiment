/**
 * Catalogue seed, from the JSON files in ./data (extracted from the old 3,700-line seed.ts).
 *
 * 1. The JSON is validated with zod BEFORE anything is written.
 * 2. Every name reference (material, labour, supplier) is checked: an unknown name STOPS
 *    the seed with the full list. The old seed silently skipped them — 14 materials ended up
 *    with no supplier and several prestations with no composition.
 * 3. Idempotent: re-running updates prices/descriptions and rebuilds compositions.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { PrismaClient, Unite } from '../../generated/prisma/client';

/**
 * JSON next to this file (tsx, nest build copies them — see nest-cli.json "assets"),
 * else the sources (a plain `tsc` build used by the demo CLI does not copy JSON files).
 */
const DATA_DIR = [join(__dirname, 'data'), resolve(process.cwd(), 'src/database/seed/data')].find((d) => existsSync(d)) ?? join(__dirname, 'data');

const unite = z.nativeEnum(Unite);
const component = z
  .object({ materiau: z.string().optional(), serviceMo: z.string().optional(), qte: z.number().positive() })
  .refine((c) => Boolean(c.materiau) !== Boolean(c.serviceMo), 'materiau OU serviceMo');

const schemas = {
  fournisseurs: z.array(
    z.object({
      nom: z.string(),
      contact: z.string().nullish(),
      email: z.string().nullish(),
      telephone: z.string().nullish(),
      adresse: z.string().nullish(),
      typesMateriaux: z.string().nullish(),
      delaiLivraison: z.number().int().nullish(),
      conditions: z.string().nullish(),
    }),
  ),
  materiaux: z.array(
    z.object({
      nom: z.string(),
      couleur: z.string().nullish(),
      finition: z.string().nullish(),
      unite,
      prixAchatFixe: z.number().nonnegative(),
      fournisseur: z.string(),
    }),
  ),
  services: z.array(
    z.object({
      nom: z.string(),
      unite,
      prixUnitaire: z.number().nonnegative(),
      productiviteJour: z.number().nullish(),
      coutJournalier: z.number().nullish(),
    }),
  ),
  catalogue: z.array(
    z.object({
      nom: z.string(),
      description: z.string().nullish(),
      sousCategories: z.array(
        z.object({
          nom: z.string(),
          description: z.string().nullish(),
          prestations: z.array(
            z.object({
              nom: z.string(),
              description: z.string().nullish(),
              unite,
              prixVenteMin: z.number().nonnegative(),
              prixVenteMax: z.number().nonnegative(),
              compositions: z.array(component),
              options: z.array(
                z.object({
                  nom: z.string(),
                  obligatoire: z.boolean(),
                  choix: z.array(
                    z.object({
                      nom: z.string(),
                      impactPrix: z.number(),
                      compositions: z.array(component).optional(),
                    }),
                  ),
                }),
              ),
            }),
          ),
        }),
      ),
    }),
  ),
};

type Catalogue = z.infer<typeof schemas.catalogue>;
type Component = z.infer<typeof component>;

function load<T>(file: string, schema: z.ZodType<T>): T {
  const raw: unknown = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));
  return schema.parse(raw);
}

/** Collects every broken name reference before writing anything. */
function checkReferences(data: {
  fournisseurs: { nom: string }[];
  materiaux: { nom: string; fournisseur: string }[];
  services: { nom: string }[];
  catalogue: Catalogue;
}): void {
  const fournisseurs = new Set(data.fournisseurs.map((f) => f.nom));
  const materiaux = new Set(data.materiaux.map((m) => m.nom));
  const services = new Set(data.services.map((s) => s.nom));
  const problems: string[] = [];

  for (const m of data.materiaux) {
    if (!fournisseurs.has(m.fournisseur)) problems.push(`matériau « ${m.nom} » : fournisseur inconnu « ${m.fournisseur} »`);
  }
  const checkComponents = (where: string, list: Component[] = []) => {
    for (const c of list) {
      if (c.materiau && !materiaux.has(c.materiau)) problems.push(`${where} : matériau inconnu « ${c.materiau} »`);
      if (c.serviceMo && !services.has(c.serviceMo)) problems.push(`${where} : main d'œuvre inconnue « ${c.serviceMo} »`);
    }
  };
  for (const cat of data.catalogue)
    for (const sc of cat.sousCategories)
      for (const p of sc.prestations) {
        checkComponents(`prestation « ${p.nom} »`, p.compositions);
        for (const o of p.options) for (const ch of o.choix) checkComponents(`choix « ${p.nom} / ${ch.nom} »`, ch.compositions);
      }

  if (problems.length) {
    throw new Error(`Références introuvables dans prisma/seed/data :\n  - ${problems.join('\n  - ')}`);
  }
}

export async function seedCatalogue(prisma: PrismaClient, companyId: number) {
  const data = {
    fournisseurs: load('fournisseurs.json', schemas.fournisseurs),
    materiaux: load('materiaux.json', schemas.materiaux),
    services: load('services-main-oeuvre.json', schemas.services),
    catalogue: load('catalogue.json', schemas.catalogue),
  };
  checkReferences(data);

  // ── suppliers, materials, labour (looked up by name; names are unique in the data) ──
  const fournisseurIds = new Map<string, number>();
  for (const f of data.fournisseurs) {
    const existing = await prisma.fournisseur.findFirst({ where: { companyId, nom: f.nom } });
    const row = existing
      ? await prisma.fournisseur.update({ where: { id: existing.id }, data: f })
      : await prisma.fournisseur.create({ data: { ...f, companyId } });
    fournisseurIds.set(f.nom, row.id);
  }

  const materiauIds = new Map<string, number>();
  for (const { fournisseur, ...m } of data.materiaux) {
    const values = { ...m, fournisseurId: fournisseurIds.get(fournisseur)! };
    const existing = await prisma.materiau.findFirst({ where: { companyId, nom: m.nom } });
    const row = existing
      ? await prisma.materiau.update({ where: { id: existing.id }, data: values })
      : await prisma.materiau.create({ data: { ...values, companyId } });
    materiauIds.set(m.nom, row.id);
  }

  const serviceIds = new Map<string, number>();
  for (const s of data.services) {
    const existing = await prisma.serviceMainOeuvre.findFirst({ where: { companyId, nom: s.nom } });
    const row = existing
      ? await prisma.serviceMainOeuvre.update({ where: { id: existing.id }, data: s })
      : await prisma.serviceMainOeuvre.create({ data: { ...s, companyId } });
    serviceIds.set(s.nom, row.id);
  }

  const toRows = (list: Component[] = []) =>
    list.map((c) => ({
      materiauId: c.materiau ? materiauIds.get(c.materiau)! : null,
      serviceMainOeuvreId: c.serviceMo ? serviceIds.get(c.serviceMo)! : null,
      quantiteParUnite: c.qte,
    }));

  // ── categories → sub-categories → prestations → options → choices ──
  const counts = { categories: 0, sousCategories: 0, prestations: 0, options: 0, choix: 0, compositions: 0 };

  for (const cat of data.catalogue) {
    const categorie = await prisma.categoriePrestation.upsert({
      where: { companyId_nom: { companyId, nom: cat.nom } },
      update: { description: cat.description },
      create: { companyId, nom: cat.nom, description: cat.description },
    });
    counts.categories++;

    for (const sc of cat.sousCategories) {
      const sousCategorie = await prisma.sousCategorie.upsert({
        where: { categorieId_nom: { categorieId: categorie.id, nom: sc.nom } },
        update: { description: sc.description },
        create: { companyId, categorieId: categorie.id, nom: sc.nom, description: sc.description },
      });
      counts.sousCategories++;

      for (const { compositions, options, ...p } of sc.prestations) {
        const existing = await prisma.prestation.findFirst({
          where: { companyId, sousCategorieId: sousCategorie.id, nom: p.nom },
        });
        const prestation = existing
          ? await prisma.prestation.update({ where: { id: existing.id }, data: p })
          : await prisma.prestation.create({
              data: { ...p, companyId, categorieId: categorie.id, sousCategorieId: sousCategorie.id },
            });
        counts.prestations++;

        await prisma.prestationComposition.deleteMany({ where: { prestationId: prestation.id } });
        await prisma.prestationComposition.createMany({
          data: toRows(compositions).map((r) => ({ ...r, prestationId: prestation.id })),
        });
        counts.compositions += compositions.length;

        for (const [ordreOption, o] of options.entries()) {
          const option = await prisma.optionPrestation.upsert({
            where: { prestationId_nom: { prestationId: prestation.id, nom: o.nom } },
            update: { obligatoire: o.obligatoire, ordre: ordreOption },
            create: { prestationId: prestation.id, nom: o.nom, obligatoire: o.obligatoire, ordre: ordreOption },
          });
          counts.options++;

          for (const [ordre, ch] of o.choix.entries()) {
            const choix = await prisma.choixOption.upsert({
              where: { optionId_nom: { optionId: option.id, nom: ch.nom } },
              update: { impactPrix: ch.impactPrix, ordre, actif: true },
              create: { optionId: option.id, nom: ch.nom, impactPrix: ch.impactPrix, ordre },
            });
            counts.choix++;

            await prisma.choixOptionComposition.deleteMany({ where: { choixOptionId: choix.id } });
            if (ch.compositions?.length) {
              await prisma.choixOptionComposition.createMany({
                data: toRows(ch.compositions).map((r) => ({ ...r, choixOptionId: choix.id })),
              });
              counts.compositions += ch.compositions.length;
            }
          }
        }
      }
    }
  }

  return {
    fournisseurs: data.fournisseurs.length,
    materiaux: data.materiaux.length,
    servicesMainOeuvre: data.services.length,
    ...counts,
  };
}
