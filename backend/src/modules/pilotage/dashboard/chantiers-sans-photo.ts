/** No photo for this long on a job site in progress → shown on the dashboard (Étape 6 of 26/10). */
export const JOURS_SANS_PHOTO = 2;

export function chantiersSansPhoto(
  chantiers: { id: number; reference: string; client: { nom: string; prenom: string | null }; photosAvancement: { createdAt: Date }[] }[],
  now: Date,
) {
  const limite = now.getTime() - JOURS_SANS_PHOTO * 86_400_000;
  const liste = chantiers
    .map(({ photosAvancement, ...c }) => ({ ...c, dernierePhoto: photosAvancement[0]?.createdAt ?? null }))
    .filter((c) => !c.dernierePhoto || c.dernierePhoto.getTime() < limite)
    // never any photo first, then the oldest last photo
    .sort((a, b) => (a.dernierePhoto?.getTime() ?? 0) - (b.dernierePhoto?.getTime() ?? 0));
  return { nombre: liste.length, liste: liste.slice(0, 5) };
}
