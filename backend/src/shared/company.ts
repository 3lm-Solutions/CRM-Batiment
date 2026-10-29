/** Company-wide settings used by pricing, quotes and invoices. */
export interface CompanySettings {
  tvaDefaut: number;
  devise: string;
  acomptePercentDefault: number;
  margeCiblePourcent: number;
  seuilAlerteMargePourcent: number;
  fraisFixeDeplacement: number;
  pasArrondiPrix: number;
  /** Months of after-sales service after the end of the works (0 = no limit) — 26/10 */
  savDureeMois: number;
  /** Months of signed quotes / orders used for the market prices: 6, 12 or 24 — 29/10 */
  prixMarcheMois: number;
}
