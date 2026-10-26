import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, DataTable, ErrorState, Input, PageHeader, Pagination, Select, type Tone } from '@/components/ui';
import { formatDateTime, fullName } from '@/lib/format';
import { useAudit, type AuditQuery } from './api';

const ACTIONS: Record<string, [string, Tone]> = {
  PRIX_MODIFIE: ['Prix catalogue modifié', 'amber'],
  PRIX_LIGNE_MODIFIE: ['Prix d’une ligne de devis', 'amber'],
  DEVIS_ENVOYE: ['Devis envoyé', 'blue'],
  DEVIS_ACCEPTE: ['Devis accepté', 'violet'],
  DEVIS_REFUSE: ['Devis refusé', 'red'],
  DEVIS_SIGNE: ['Devis signé', 'green'],
  DEVIS_ANNULE: ['Devis annulé', 'slate'],
  FACTURE_EMISE: ['Facture émise', 'blue'],
  FACTURE_PAYEE: ['Facture payée', 'green'],
  FACTURE_ANNULEE: ['Facture annulée (avoir)', 'red'],
  RELANCE_DEVIS: ['Relance devis', 'amber'],
  RELANCE_FACTURE: ['Relance facture', 'amber'],
};

const ENTITES: Record<string, { label: string; link?: (id: number) => string }> = {
  Devis: { label: 'Devis', link: (id) => `/devis/${id}` },
  Facture: { label: 'Facture', link: (id) => `/factures/${id}` },
  Prestation: { label: 'Prestation', link: (id) => `/catalogue/prestations/${id}` },
  Materiau: { label: 'Matériau' },
  ServiceMainOeuvre: { label: 'Main-d’œuvre' },
};

const LABELS: Record<string, string> = {
  prixAchatFixe: 'Prix d’achat',
  prixUnitaireVente: 'Prix de vente',
  tauxHoraire: 'Taux horaire',
  prixAchat: 'Prix d’achat',
  totalHT: 'Total HT',
  totalTTC: 'Total TTC',
  montantTTC: 'Montant TTC',
  statut: 'Statut',
  reference: 'Référence',
  niveau: 'Relance n°',
  par: 'Par',
  destinataire: 'Destinataire',
  emailEnvoye: 'Email envoyé',
};

/** Before → after, one line per changed field. */
function Diff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  if (!keys.length) return <span className="text-slate-400">—</span>;
  const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  return (
    <ul className="space-y-0.5 text-xs">
      {keys.slice(0, 6).map((k) => (
        <li key={k}>
          <span className="text-slate-500">{LABELS[k] ?? k} : </span>
          {before && k in before && <span className="text-red-600 line-through">{show(before[k])}</span>}
          {before && k in before && after && k in after && ' → '}
          {after && k in after && <span className="font-medium text-emerald-700 dark:text-emerald-400">{show(after[k])}</span>}
        </li>
      ))}
    </ul>
  );
}

export function AuditPage() {
  const [query, setQuery] = useState<AuditQuery>({ page: 1, entite: '', action: '', du: '', au: '' });
  const audit = useAudit(query);
  const set = (patch: Partial<AuditQuery>) => setQuery((q) => ({ ...q, ...patch, page: 1 }));

  return (
    <>
      <PageHeader title="Historique" description="Traçabilité des prix, des envois et signatures de devis, et des factures. Non modifiable." />
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 px-6 py-4 dark:border-slate-800">
          <Select aria-label="Type d’objet" containerClassName="w-44" placeholder="Tous les objets" options={Object.entries(ENTITES).map(([value, e]) => ({ value, label: e.label }))} value={query.entite} onChange={(e) => set({ entite: e.target.value })} />
          <Select aria-label="Action" containerClassName="w-56" placeholder="Toutes les actions" options={Object.entries(ACTIONS).map(([value, [label]]) => ({ value, label }))} value={query.action} onChange={(e) => set({ action: e.target.value })} />
          <Input label="Du" type="date" containerClassName="w-40" value={query.du} onChange={(e) => set({ du: e.target.value })} />
          <Input label="Au" type="date" containerClassName="w-40" min={query.du || undefined} value={query.au} onChange={(e) => set({ au: e.target.value })} />
        </div>
        {audit.isError ? (
          <div className="p-4"><ErrorState error={audit.error} onRetry={() => void audit.refetch()} /></div>
        ) : (
          <DataTable
            loading={audit.isPending}
            rows={audit.data?.data}
            rowKey={(r) => r.id}
            empty={{ title: 'Aucun événement', description: 'Modifiez les filtres.' }}
            columns={[
              { key: 'date', header: 'Date', className: 'whitespace-nowrap', cell: (r) => formatDateTime(r.createdAt) },
              {
                key: 'action',
                header: 'Action',
                cell: (r) => {
                  const [label, tone] = ACTIONS[r.action] ?? [r.action, 'slate' as Tone];
                  return <Badge tone={tone}>{label}</Badge>;
                },
              },
              {
                key: 'objet',
                header: 'Objet',
                cell: (r) => {
                  const e = ENTITES[r.entite];
                  const ref = (r.nouvelleValeur?.reference ?? r.ancienneValeur?.reference ?? `#${r.entiteId}`) as string;
                  const text = `${e?.label ?? r.entite} ${ref}`;
                  return e?.link ? <Link to={e.link(r.entiteId)} className="text-brand-700 hover:underline dark:text-blue-300">{text}</Link> : text;
                },
              },
              { key: 'diff', header: 'Changement', cell: (r) => <Diff before={r.ancienneValeur} after={r.nouvelleValeur} /> },
              { key: 'user', header: 'Par', cell: (r) => (r.user ? fullName(r.user) : <span className="text-slate-500">Client / système</span>) },
            ]}
          />
        )}
        <Pagination meta={audit.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
    </>
  );
}
