import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Dashboard } from './api';

const SHORT = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' });

/**
 * Quotes sent per week, with how many were accepted / refused.
 * Grouped bars (not stacked): "sent" is the total, the two others are subsets of it.
 * Colours: brand blue for volume, green / red for outcomes, each paired with a legend label.
 */
export function DevisChart({ data }: { data: Dashboard['serieDevis'] }) {
  const rows = data.map((d) => ({ ...d, label: SHORT.format(new Date(d.semaine)) }));
  const empty = rows.every((r) => r.envoyes === 0);

  if (empty) return <p className="py-16 text-center text-sm text-slate-500">Aucun devis envoyé sur les 12 dernières semaines.</p>;

  return (
    <div className="h-72 w-full" role="img" aria-label="Devis envoyés, acceptés et refusés par semaine sur 12 semaines">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} width={40} />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.12)' }}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
            labelFormatter={(l) => `Semaine du ${String(l)}`}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
          <Bar dataKey="envoyes" name="Envoyés" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="acceptes" name="Acceptés / signés" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="refuses" name="Refusés" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
