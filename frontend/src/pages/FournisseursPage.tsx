import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Fournisseur } from '@/types';
import {
  Plus, Search, Edit, Trash2, X, Truck, Loader2,
  Phone, Mail, Download,
} from 'lucide-react';

export default function FournisseursPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState<Fournisseur | null>(null);
  const [form, setForm] = useState({
    nom: '',
    contact: '',
    email: '',
    telephone: '',
    adresse: '',
    typesMateriaux: '',
    conditions: '',
  });

  const { data: fournisseurs, isLoading } = useQuery({
    queryKey: ['fournisseurs', search],
    queryFn: async () => {
      const params: Record<string, unknown> = { actif: true };
      if (search) params.search = search;
      const res = await api.get('/fournisseurs', { params });
      return (res.data?.data ?? res.data) as Fournisseur[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/fournisseurs', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fournisseurs'] });
      setShowModal(false);
      setEditingFournisseur(null);
      setForm({ nom: '', contact: '', email: '', telephone: '', adresse: '', typesMateriaux: '', conditions: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api.patch(`/fournisseurs/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fournisseurs'] });
      setShowModal(false);
      setEditingFournisseur(null);
      setForm({ nom: '', contact: '', email: '', telephone: '', adresse: '', typesMateriaux: '', conditions: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/fournisseurs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fournisseurs'] }),
  });

  function openCreateModal() {
    setEditingFournisseur(null);
    setForm({ nom: '', contact: '', email: '', telephone: '', adresse: '', typesMateriaux: '', conditions: '' });
    setShowModal(true);
  }

  function openEditModal(fournisseur: Fournisseur) {
    setEditingFournisseur(fournisseur);
    setForm({
      nom: fournisseur.nom ?? '',
      contact: fournisseur.contact ?? '',
      email: fournisseur.email ?? '',
      telephone: fournisseur.telephone ?? '',
      adresse: fournisseur.adresse ?? '',
      typesMateriaux: fournisseur.typesMateriaux ?? '',
      conditions: fournisseur.conditions ?? '',
    });
    setShowModal(true);
  }

  function escapeCsvValue(value: string) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  function handleExport() {
    if (list.length === 0) return;

    const headers = [
      'Nom',
      'Contact',
      'Email',
      'Telephone',
      'Adresse',
      'TypesMateriaux',
      'Conditions',
      'Actif',
    ];

    const rows = list.map((fournisseur) => [
      fournisseur.nom ?? '',
      fournisseur.contact ?? '',
      fournisseur.email ?? '',
      fournisseur.telephone ?? '',
      fournisseur.adresse ?? '',
      fournisseur.typesMateriaux ?? '',
      fournisseur.conditions ?? '',
      fournisseur.actif ? 'Oui' : 'Non',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsvValue(String(value))).join(';'))
      .join('\n');

    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fournisseurs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { nom: form.nom };
    if (form.contact) body.contact = form.contact;
    if (form.email) body.email = form.email;
    if (form.telephone) body.telephone = form.telephone;
    if (form.adresse) body.adresse = form.adresse;
    if (form.typesMateriaux) body.typesMateriaux = form.typesMateriaux;
    if (form.conditions) body.conditions = form.conditions;

    if (editingFournisseur) {
      updateMutation.mutate({ id: editingFournisseur.id, body });
      return;
    }

    createMutation.mutate(body);
  }

  const list = fournisseurs ?? [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck size={24} className="text-violet-600" />
            Gestion des Fournisseurs
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{list.length} fournisseur(s) enregistré(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={isLoading || list.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} /> Exporter
          </button>
          <button onClick={openCreateModal} className="inline-flex items-center gap-2 batiflow-gradient text-white px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all font-medium text-sm">
            <Plus size={17} /> Nouveau fournisseur
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher un fournisseur..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 text-sm transition-all" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
      ) : list.length === 0 ? (
        <div className="text-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Truck size={32} className="text-gray-300" /></div>
          <p className="text-lg font-semibold text-gray-700">Aucun fournisseur trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((f) => (
            <div key={f.id} className="bg-white rounded-2xl border border-gray-100 p-5 card-hover shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center">
                  <Truck size={20} />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditModal(f)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50"><Edit size={14} /></button>
                  <button onClick={() => deleteMutation.mutate(f.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.nom}</h3>
              <div className="space-y-1.5 text-sm text-gray-500">
                {f.contact && <p className="text-xs text-gray-600">{f.contact}</p>}
                {f.email && <p className="flex items-center gap-2"><Mail size={14} /> {f.email}</p>}
                {f.telephone && <p className="flex items-center gap-2"><Phone size={14} /> {f.telephone}</p>}
                {f.typesMateriaux && <p className="text-xs mt-1">Types : {f.typesMateriaux}</p>}
              </div>
              {f.materiaux && f.materiaux.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1.5">{f.materiaux.length} matériau(x) fourni(s)</p>
                  <div className="flex flex-wrap gap-1">
                    {f.materiaux.slice(0, 3).map((m) => (
                      <span key={m.id} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{m.nom}</span>
                    ))}
                    {f.materiaux.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">+{f.materiaux.length - 3}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editingFournisseur ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
                <input type="text" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact</label>
                <input type="text" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone</label>
                  <input type="text" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse</label>
                <input type="text" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Types de matériaux</label>
                <input type="text" placeholder="Bois, Béton, Acier..." value={form.typesMateriaux} onChange={(e) => setForm({ ...form, typesMateriaux: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Conditions</label>
                <textarea value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" />
              </div>
              {createMutation.error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">Erreur lors de la création.</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Annuler</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-6 py-2.5 text-sm font-medium text-white batiflow-gradient rounded-xl hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2 transition-all">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 size={16} className="animate-spin" />}
                  {editingFournisseur ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
