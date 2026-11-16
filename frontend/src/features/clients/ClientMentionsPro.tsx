import { cn } from '@/lib/cn';
import { formatSiret, type ClientPro } from './api';

/**
 * Company client lines printed under the client's name on quotes and invoices (Étape 1 of 26/10):
 * SIRET, intra-community VAT number, contact person. Nothing for a private person.
 */
export function ClientMentionsPro({ client, className }: { client: ClientPro; className?: string }) {
  if (client.typeClient === 'PARTICULIER') return null;
  const lignes = [
    client.contactNom && `À l’attention de ${client.contactNom}`,
    client.siret && `SIRET ${formatSiret(client.siret)}`,
    client.tvaIntracom && `TVA intracom. ${client.tvaIntracom}`,
  ].filter(Boolean);
  if (!lignes.length) return null;
  return (
    <div className={cn('text-slate-600 dark:text-slate-400', className)}>
      {lignes.map((l) => <p key={l as string}>{l}</p>)}
    </div>
  );
}
