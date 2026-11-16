const EUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' });

export const formatEuros = (value: number | { toNumber(): number }) =>
  EUR.format(typeof value === 'number' ? value : value.toNumber());

export const formatDate = (value: Date) => DATE.format(value);
