import { AlertTriangle, BellRing, Boxes, ClipboardList, Euro, HardHat, Percent, Receipt, Send, TrendingUp, Truck, Wrench, XCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, ErrorState, Loading, Select, Stat, StatusBadge, WelcomeBanner } from '@/components/ui';
import { useAuth } from '../auth/auth-context';
import { BRAND } from '@/lib/brand';
import { formatDate, formatEuros, formatNumber, formatPercent, fullName } from '@/lib/format';
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
            {/* Information, not a to-do: the reminders already went out (C3 of 21/10) */}
            <p className="flex items-center gap-2 px-1 pt-1 text-xs text-slate-500">
              <BellRing className="size-3.5" aria-hidden />
              {d.relancesSemaine ? `${d.relancesSemaine} relance(s) client envoyée(s) ces 7 derniers jours` : 'Aucune relance client ces 7 derniers jours'}
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Marge par chantier"
          description={`Marge prévue des devis signés · chantiers en cours et terminés · les plus faibles d’abord${
            d.margesChantiers.margeMoyennePonderee !== null ? ` · moyenne pondérée ${formatPercent(d.margesChantiers.margeMoyennePonderee)}` : ''
          }`}
          actions={
            d.margesChantiers.sousSeuil > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                <AlertTriangle className="size-3.5" aria-hidden /> {d.margesChantiers.sousSeuil} sous {formatPercent(d.margesChantiers.seuil)}
              </span>
            )
          }
        />
        {d.margesChantiers.liste.length === 0 ? (
          <p className="flex items-center gap-2 px-5 py-4 text-sm text-slate-500"><Percent className="size-4" /> Aucun chantier avec un devis signé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 dark:border-slate-800">
                  <th className="px-5 py-2.5">Chantier</th>
                  <th className="px-5 py-2.5">Statut</th>
                  <th className="px-5 py-2.5 text-right">Total HT</th>
                  <th className="px-5 py-2.5 text-right">Marge prévue</th>
                  <th className="px-5 py-2.5 text-right">Marge %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.margesChantiers.liste.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-2.5">
                      <Link to={`/chantiers/${c.id}`} className="font-medium text-brand-700 hover:underline dark:text-blue-300">{c.reference}</Link>
                      <span className="text-slate-500"> · {fullName(c.client)}</span>
                    </td>
                    <td className="px-5 py-2.5"><StatusBadge kind="chantier" value={c.statut} /></td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{formatEuros(c.totalHT)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{formatEuros(c.profit)}</td>
                    <td className={cn('px-5 py-2.5 text-right font-semibold tabular-nums', c.alerte ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400')}>
                      {c.alerte && <AlertTriangle className="mr-1 inline size-3.5 align-[-2px]" aria-label="Sous le seuil" />}
                      {c.margePourcent === null ? '—' : formatPercent(c.margePourcent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {d.margesChantiers.nombre > d.margesChantiers.liste.length && (
              <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-800">
                {d.margesChantiers.liste.length} chantiers les moins rentables sur {d.margesChantiers.nombre}.
              </p>
            )}
          </div>
        )}
      </Card>

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
