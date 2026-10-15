/** Company-wide settings used by pricing, quotes and invoices. */
export interface CompanySettings {
  tvaDefaut: number;
  devise: string;
  acomptePercentDefault: number;
  margeCiblePourcent: number;
  seuilAlerteMargePourcent: number;
  fraisFixeDeplacement: number;
  pasArrondiPrix: number;
}
