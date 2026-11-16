import { useState } from 'react';
import { Input } from '@/components/ui';
import { fullName } from '@/lib/format';
import { useClients } from '../clients/api';

/** Searchable client selector (server-side search, 8 results). */
export function ClientPicker({ value, onChange, error }: { value: number | null; onChange: (id: number | null) => void; error?: string }) {
  const [search, setSearch] = useState('');
  const [label, setLabel] = useState('');
  const clients = useClients({ page: 1, search, limit: 8 }, search.length > 0 && !value);

  return (
    <div>
      <Input
        label="Client"
        required
        placeholder="Rechercher un client par nom, email, téléphone…"
        value={value ? label : search}
        error={error}
        onChange={(e) => {
          onChange(null);
          setSearch(e.target.value);
        }}
      />
      {!value && search.length > 0 && (
        <ul className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900" role="listbox" aria-label="Clients trouvés">
          {clients.data?.data.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Aucun client trouvé</li>}
          {clients.data?.data.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-brand-100/60 dark:hover:bg-slate-800"
                onClick={() => {
                  setLabel(fullName(c));
                  onChange(c.id);
                }}
              >
                <span className="font-medium">{fullName(c)}</span>
                <span className="ml-2 text-slate-500">{c.email ?? c.telephone ?? ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
