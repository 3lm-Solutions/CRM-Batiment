import { AlertTriangle, Boxes, ClipboardList, Euro, HardHat, Percent, Receipt, Send, TrendingUp, Truck, Wrench, XCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, ErrorState, Loading, Select, Stat, WelcomeBanner } from '@/components/ui';
import { useAuth } from '../auth/auth-context';
import { BRAND } from '@/lib/brand';
import { formatDate, formatEuros, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useDashboard } from './api';
import { DevisChart } from './DevisChart';

const PERIODES = [
  { value: 7, label: '7 derniers jours' },
  { value: 30, label: '30 derniers jours' },
  { value: 90, label: '3 derniers mois' },
  { value: 365, label: '12 derniers mois' },
];

/** One "to do" line: an icon, a count, where to go. Highlighted when non-zero. */
function Alerte({ to, icon, label, count, detail }: { to: string; icon: ReactNode; label: string; count: number; detail?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3 transition hover:shadow-sm',
        count ? 'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30' : 'border-gray-100 dark:border-slate-800',
      )}
    >
      <span className={cn('rounded-lg p-2', count ? 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200' : 'bg-gray-100 text-gray-500 dark:bg-slate-800')}>{icon}</span>
      <span className="flex-1 text-sm">
        <span className="font-medium">{label}</span>
        {detail && <span className="block text-xs text-slate-500">{detail}</span>}
      </span>
      <span className="text-xl font-bold tabular-nums">{count}</span>
    </Link>
  );
}

export function DashboardPage() {
  const [jours, setJours] = useState(30);
  const dashboard = useDashboard(jours);
  const { user } = useAuth();

  if (dashboard.isPending) return <Loading />;
  if (dashboard.isError) return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  const d = dashboard.data;

  return (
    <>
      <WelcomeBanner
        prenom={user?.prenom ?? ''}
        label={`${BRAND.name} — tableau de bord`}
        actions={<Select aria-label="Période" containerClassName="w-48" options={PERIODES} value={jours} onChange={(e) => setJours(Number(e.target.value))} />}
      >
        Voici un aperçu de votre activité : ventes, encaissements et points d’attention.
      </WelcomeBanner>

      <div className={cn('grid gap-6 sm:grid-cols-2 lg:grid-cols-4', dashboard.isFetching && 'opacity-70')}>
        <Stat icon={<Euro />} iconTone="green" label="CA signé ce mois (HT)" value={formatEuros(d.chiffreAffaires.signeMoisHT)} hint={`${d.chiffreAffaires.devisSignesMois} signé(s)`} tone="success" />
        <Stat icon={<TrendingUp />} iconTone="blue" label="Taux de conversion" value={formatPercent(d.devis.tauxConversion)} hint={`${d.devis.acceptes} / ${d.devis.envoyes}`} />
        <Stat icon={<Percent />} iconTone="purple" label="Marge moyenne (devis signés)" value={formatPercent(d.margeMoyennePourcent)} />
        <Stat
          icon={<Receipt />}
          iconTone="orange"
          label="Factures à encaisser (TTC)"
          value={formatEuros(d.facturesImpayees.montantTTC)}
          hint={d.facturesImpayees.enRetard.nombre ? `${d.facturesImpayees.enRetard.nombre} en retard` : `${d.facturesImpayees.nombre} facture(s)`}
          tone={d.facturesImpayees.enRetard.nombre ? 'warning' : 'default'}
        />
        <Stat icon={<ClipboardList />} iconTone="orange" label="Demandes en cours" value={formatNumber(d.prospects.demandesActives)} hint={`+${d.prospects.nouveauxClients} clients`} />
        <Stat icon={<Send />} iconTone="blue" label="Devis envoyés sur la période" value={formatNumber(d.devis.envoyes)} />
        <Stat icon={<XCircle />} iconTone="red" label="Devis refusés sur la période" value={formatNumber(d.devis.refuses)} />
        <Stat icon={<HardHat />} iconTone="gray" label="Chantiers en retard" value={formatNumber(d.chantiersEnRetard.nombre)} tone={d.chantiersEnRetard.nombre ? 'warning' : 'default'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Devis par semaine" description="12 dernières semaines, par date d’envoi" />
          <div className="p-4"><DevisChart data={d.serieDevis} /></div>
        </Card>
        <Card>
          <CardHeader title="À traiter" />
          <div className="space-y-2 p-4">
            <Alerte to="/factures" icon={<Receipt className="size-4" />} label="Factures en retard" count={d.facturesImpayees.enRetard.nombre} detail={formatEuros(d.facturesImpayees.enRetard.montantTTC)} />
            <Alerte to="/sav" icon={<Wrench className="size-4" />} label="Tickets SAV ouverts" count={d.sav.ouverts} detail={d.sav.urgents ? `dont ${d.sav.urgents} urgent(s)` : undefined} />
            <Alerte to="/commandes" icon={<Truck className="size-4" />} label="Commandes en attente" count={d.commandesEnAttente} detail="à envoyer ou à réceptionner" />
            <Alerte to="/stock" icon={<Boxes className="size-4" />} label="Matériaux sous le seuil" count={d.stockAlertes} />
            <Alerte to="/demandes" icon={<ClipboardList className="size-4" />} label="Demandes de devis" count={d.prospects.demandesActives} />
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Chantiers en retard" description="Date de fin prévue dépassée" />
        {d.chantiersEnRetard.liste.length === 0 ? (
          <p className="flex items-center gap-2 px-5 py-4 text-sm text-slate-500"><HardHat className="size-4" /> Aucun chantier en retard.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {d.chantiersEnRetard.liste.map((c) => (
              <li key={c.id}>
                <Link to={`/chantiers/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <span><span className="font-medium">{c.reference}</span> <span className="text-slate-500">· {c.client.nom} · fin prévue {formatDate(c.dateFin)}</span></span>
                  <span className="inline-flex items-center gap-1 font-semibold text-red-600"><AlertTriangle className="size-4" aria-hidden /> {c.joursRetard} j</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
