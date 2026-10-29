import { Download, FileUp, TrendingDown, TrendingUp, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ConfirmDialog, DataTable, ErrorState, PageHeader, Pagination, SearchInput, Tabs } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDateTime, formatEuros, formatUnite, fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { telechargerModele, useBareme, useImporterBareme, usePrixMarche, useViderBareme, type PrixMarche, type PrixMarcheItem, type PrixMarcheQuery, type ResultatImport } from './api';
import { fourchettePrix, libelleSource, titrePrixMarche } from './PrixMarcheBadge';

const TONE = { DEVIS: 'green', COMMANDES: 'blue', BAREME: 'violet' } as const;

/** One market price cell: range, source, trend. */
function CelluleMarche({ m, periodeMois }: { m: PrixMarche | null; periodeMois?: number }) {
  if (!m) return <span className="text-xs text-slate-400">Pas assez de données</span>;
  return (
    <span className="block" title={titrePrixMarche(m, periodeMois)}>
      <span className="block font-medium tabular-nums">{fourchettePrix(m)}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <Badge tone={TONE[m.source]}>{m.source === 'BAREME' ? 'Barème' : `${m.nombre} ${m.source === 'DEVIS' ? 'devis' : 'cmd'}`}</Badge>
        {m.mediane !== null && <>médiane {formatEuros(m.mediane)}</>}
      </span>
    </span>
  );
}

/** Trend over the period and the price expected in 6 months (« prédictif »). */
function CelluleTendance({ m }: { m: PrixMarche | null }) {
  if (!m || m.tendancePctAn === null) return <span className="text-xs text-slate-400">—</span>;
  const hausse = m.tendancePctAn > 0;
  return (
    <span className="block text-sm">
      <span className={hausse ? 'flex items-center gap-1 font-medium text-red-700 dark:text-red-400' : 'flex items-center gap-1 font-medium text-green-700 dark:text-green-400'}>
        {hausse ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
        {hausse ? '+' : ''}{String(m.tendancePctAn).replace('.', ',')} %/an
      </span>
      {m.estime6Mois !== null && <span className="text-xs text-slate-500">≈ {formatEuros(m.estime6Mois)} dans 6 mois</span>}
    </span>
  );
}

/** Admin: the imported price list (CSV) — template, import, clear. */
function BaremeCard() {
  const info = useBareme(true);
  const importer = useImporterBareme();
  const vider = useViderBareme();
  const input = useRef<HTMLInputElement>(null);
  const [resultat, setResultat] = useState<ResultatImport | null>(null);
  const [confirmer, setConfirmer] = useState(false);

  const envoyer = (f: File | undefined) => {
    if (!f) return;
    setResultat(null);
    importer.mutate(f, {
      onSuccess: (r) => {
        setResultat(r);
        if (r.conserve) toast.error('Aucune ligne valide : le barème actuel est conservé.');
        else toast.success(`${r.importees} prix importé(s)`);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  return (
    <Card className="mb-6">
      <CardHeader
        title="Barème importé (CSV)"
        description="Utilisé quand vos devis signés ne suffisent pas (moins de 3 prix sur la période). Chaque import remplace le barème."
      />
      <div className="space-y-4 p-5">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {info.data?.nombre
            ? <>{info.data.nombre} prix importé(s) le {formatDateTime(info.data.importeLe)}{info.data.importePar && ` par ${fullName(info.data.importePar)}`}.</>
            : 'Aucun barème importé.'}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" icon={<Download className="size-4" />} onClick={() => void telechargerModele().catch((e) => toast.error(errorMessage(e)))}>
            Télécharger le modèle
          </Button>
          <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { envoyer(e.target.files?.[0]); e.target.value = ''; }} />
          <Button icon={<FileUp className="size-4" />} loading={importer.isPending} onClick={() => input.current?.click()}>Importer un CSV</Button>
          {!!info.data?.nombre && (
            <Button variant="ghost" icon={<Trash2 className="size-4 text-red-600" />} onClick={() => setConfirmer(true)}>Vider le barème</Button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Le modèle contient tout votre catalogue actif : remplissez <b>prix_min</b> et <b>prix_max</b> (HT), laissez vides les lignes sans prix.
          Colonnes : type (PRESTATION / MATERIAU), nom (comme dans le catalogue), unite, prix_min, prix_max, achat_vente (VENTE / ACHAT), source.
        </p>
        {resultat && resultat.erreurs.length > 0 && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="mb-1 font-semibold">{resultat.ignorees} ligne(s) ignorée(s){resultat.erreurs.length < resultat.ignorees && ` (${resultat.erreurs.length} premières)`} :</p>
            <ul className="max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5">
              {resultat.erreurs.map((e) => <li key={`${e.ligne}-${e.raison}`}>Ligne {e.ligne} : {e.raison}</li>)}
            </ul>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmer}
        onClose={() => setConfirmer(false)}
        danger
        title="Vider le barème"
        message="Les prix importés sont supprimés. Les prix calculés sur vos devis signés restent."
        confirmLabel="Vider"
        loading={vider.isPending}
        onConfirm={() => vider.mutate(undefined, { onSuccess: (r) => { toast.success(`${r.supprimees} prix supprimé(s)`); setConfirmer(false); setResultat(null); }, onError: (e) => toast.error(errorMessage(e)) })}
      />
    </Card>
  );
}

/**
 * « Prix de marché » (29/10): for each prestation / material, the usual price range of the
 * company's signed quotes (sale) and supplier orders (purchase) over the chosen period, the trend
 * and the expected price; the imported list (CSV) when there is not enough data.
 */
export function PrixMarchePage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [query, setQuery] = useState<PrixMarcheQuery>({ type: 'PRESTATION', page: 1, search: '' });
  const liste = usePrixMarche(query);
  const periode = liste.data?.periodeMois;
  const materiaux = query.type === 'MATERIAU';

  return (
    <>
      <PageHeader
        title="Prix de marché"
        description={
          <>
            Fourchette habituelle de vos prix (25 % – 75 %) sur {periode ?? '…'} mois de devis signés et de commandes fournisseur.
            {isAdmin && <> Période réglable dans <Link to="/parametres" className="underline">Paramètres</Link>.</>}
          </>
        }
        toolbar={<SearchInput value={query.search} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Rechercher…" />}
      />
      {isAdmin && <BaremeCard />}
      <Tabs<PrixMarcheQuery['type']>
        tabs={[{ value: 'PRESTATION', label: 'Prestations' }, { value: 'MATERIAU', label: 'Matériaux' }]}
        value={query.type}
        onChange={(type) => setQuery({ type, page: 1, search: query.search })}
      />
      <Card className="overflow-hidden">
        {liste.isError ? (
          <div className="p-4"><ErrorState error={liste.error} onRetry={() => void liste.refetch()} /></div>
        ) : (
          <DataTable<PrixMarcheItem>
            loading={liste.isPending}
            rows={liste.data?.data}
            rowKey={(r) => `${r.type}-${r.id}`}
            empty={{ title: materiaux ? 'Aucun matériau' : 'Aucune prestation', description: 'Le catalogue actif est vide ou la recherche ne trouve rien.' }}
            columns={[
              {
                key: 'nom',
                header: materiaux ? 'Matériau' : 'Prestation',
                cell: (r) => (
                  <span className="block">
                    <span className="block font-medium text-slate-800 dark:text-slate-100">{r.nom}</span>
                    <span className="text-xs text-slate-500">{[r.categorie, `par ${formatUnite(r.unite)}`].filter(Boolean).join(' · ')}</span>
                  </span>
                ),
              },
              {
                key: 'catalogue',
                header: materiaux ? 'Achat catalogue' : 'Catalogue',
                cell: (r) => <span className="tabular-nums text-slate-600 dark:text-slate-300">{r.catalogue.min === r.catalogue.max ? formatEuros(r.catalogue.min) : `${formatEuros(r.catalogue.min)} – ${formatEuros(r.catalogue.max)}`}</span>,
              },
              ...(materiaux
                ? [{ key: 'achat', header: 'Marché achat', cell: (r: PrixMarcheItem) => <CelluleMarche m={r.achat} periodeMois={periode} /> }]
                : []),
              { key: 'vente', header: materiaux ? 'Marché vente' : 'Marché (vente)', cell: (r) => <CelluleMarche m={r.vente} periodeMois={periode} /> },
              { key: 'tendance', header: 'Tendance', cell: (r) => <CelluleTendance m={materiaux ? (r.achat ?? r.vente) : r.vente} /> },
            ]}
          />
        )}
        <Pagination meta={liste.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        Sources : {(['DEVIS', 'COMMANDES', 'BAREME'] as const).map(libelleSource).join(' · ')}. Prix HT. Une prestation avec options est comparée toutes options confondues.
      </p>
    </>
  );
}
