const EUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const NUM = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const PCT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });
const DATETIME = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

export const formatEuros = (v: number | null | undefined) => (v == null ? '—' : EUR.format(v));
export const formatNumber = (v: number | null | undefined) => (v == null ? '—' : NUM.format(v));
export const formatPercent = (v: number | null | undefined) => (v == null ? '—' : `${PCT.format(v)} %`);
export const formatDate = (v: string | Date | null | undefined) => (v ? DATE.format(new Date(v)) : '—');
export const formatDateTime = (v: string | Date | null | undefined) => (v ? DATETIME.format(new Date(v)) : '—');

export const UNITE_LABELS: Record<string, string> = {
  M2: 'm²', ML: 'ml', M3: 'm³', PIECE: 'pièce', JOUR: 'jour', HEURE: 'h', LITRE: 'L', KG: 'kg', FORFAIT: 'forfait',
};
export const formatUnite = (u: string) => UNITE_LABELS[u] ?? u.toLowerCase();

export const fullName = (p?: { prenom?: string | null; nom: string } | null) =>
  p ? [p.prenom, p.nom].filter(Boolean).join(' ') : '—';

/** ISO date → value of an <input type="date"> (local day). */
export const toDateInput = (v: string | Date | null | undefined) => {
  if (!v) return '';
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** <input type="date"> value → ISO string for the API (null when empty). */
export const fromDateInput = (v: string) => (v ? new Date(`${v}T12:00:00`).toISOString() : null);

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} o` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} Ko` : `${(n / 1024 ** 2).toFixed(1)} Mo`;
