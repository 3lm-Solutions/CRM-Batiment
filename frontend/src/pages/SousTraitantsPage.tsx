import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Plus, Search, Edit, Trash2, Loader2,
  Shield, FileText, AlertCircle,
  Briefcase, CheckCircle, AlertTriangle, Users
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// Local Interfaces
interface SousTraitant {
  id: number;
  nom: string;
  siret?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  specialite?: string;
  statut: string; // ACTIF, INACTIF
}

interface ContratSousTraitant {
  id: number;
  sousTraitantId: number;
  chantierId: number;
  reference: string;
  montantHT: number;
  statut: string; // BROUILLON, EN_COURS, TERMINE, RESILIE
  dateDebut?: string;
  dateFin?: string;
  sousTraitant?: SousTraitant;
  chantier?: {
    id: number;
    reference: string;
    client: {
      nom: string;
      prenom: string;
    };
  };
}

interface AssuranceSousTraitant {
  id: number;
  sousTraitantId: number;
  typeAssurance: string; // RC_DECENNALE, RC_PROFESSIONNELLE, AUTRE
  numeroAttestation: string;
  compagnieAssurance: string;
  dateExpiration: string;
  statut: string; // VALIDE, EXPIREE, A_RENOUVELER
  sousTraitant?: SousTraitant;
}

export default function SousTraitantsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'sous-traitants' | 'contrats' | 'assurances'>('sous-traitants');
  const [search, setSearch] = useState('');

  // Modals visibility
  const [showSTModal, setShowSTModal] = useState(false);
  const [showContratModal, setShowContratModal] = useState(false);
  const [showAssuranceModal, setShowAssuranceModal] = useState(false);

  // Editing states
  const [editingST, setEditingST] = useState<SousTraitant | null>(null);
  const [editingContrat, setEditingContrat] = useState<ContratSousTraitant | null>(null);
  const [editingAssurance, setEditingAssurance] = useState<AssuranceSousTraitant | null>(null);

  // Forms states
  const [stForm, setStForm] = useState({ nom: '', siret: '', email: '', telephone: '', adresse: '', specialite: '', statut: 'ACTIF' });
  const [contratForm, setContratForm] = useState({ sousTraitantId: '', chantierId: '', reference: '', montantHT: '', statut: 'BROUILLON', dateDebut: '', dateFin: '' });
  const [assuranceForm, setAssuranceForm] = useState({ sousTraitantId: '', typeAssurance: 'RC_DECENNALE', numeroAttestation: '', compagnieAssurance: '', dateExpiration: '', statut: 'VALIDE' });

  // ----------------------------------------------------
  // Queries
  // ----------------------------------------------------

  // 1. Sous-traitants
  const { data: stData, isLoading: loadingST } = useQuery({
    queryKey: ['sous-traitants', search],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 100 };
      if (search) params.search = search;
      const res = await api.get('/sous-traitants', { params });
      return (res.data?.data ?? res.data) as SousTraitant[];
    },
  });

  // 2. Contrats
  const { data: contratData, isLoading: loadingContrats } = useQuery({
    queryKey: ['sous-traitants-contrats'],
    queryFn: async () => {
      const res = await api.get('/sous-traitants/contrats', { params: { limit: 100 } });
      return (res.data?.data ?? res.data) as ContratSousTraitant[];
    },
  });

  // 3. Assurances
  const { data: assuranceData, isLoading: loadingAssurances } = useQuery({
    queryKey: ['sous-traitants-assurances'],
    queryFn: async () => {
      const res = await api.get('/sous-traitants/assurances', { params: { limit: 100 } });
      return (res.data?.data ?? res.data) as AssuranceSousTraitant[];
    },
  });

  // 4. Chantiers (pour la création de contrats)
  const { data: chantiersData } = useQuery({
    queryKey: ['chantiers-list-simple'],
    queryFn: async () => {
      const res = await api.get('/chantiers', { params: { limit: 100 } });
      return res.data?.data ?? res.data ?? [];
    },
  });

  // ----------------------------------------------------
  // Mutations: Sous-traitants
  // ----------------------------------------------------
  const createSTMutation = useMutation({
    mutationFn: (body: any) => api.post('/sous-traitants', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sous-traitants'] });
      setShowSTModal(false);
      resetSTForm();
    },
  });

  const updateSTMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => api.patch(`/sous-traitants/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sous-traitants'] });
      setShowSTModal(false);
      setEditingST(null);
      resetSTForm();
    },
  });

  const deleteSTMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sous-traitants/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sous-traitants'] }),
  });

  // ----------------------------------------------------
  // Mutations: Contrats
  // ----------------------------------------------------
  const createContratMutation = useMutation({
    mutationFn: (body: any) => api.post('/sous-traitants/contrats', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sous-traitants-contrats'] });
      setShowContratModal(false);
      resetContratForm();
    },
  });

  const updateContratMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => api.patch(`/sous-traitants/contrats/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sous-traitants-contrats'] });
      setShowContratModal(false);
      setEditingContrat(null);
      resetContratForm();
    },
  });

  const deleteContratMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sous-traitants/contrats/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sous-traitants-contrats'] }),
  });

  // ----------------------------------------------------
  // Mutations: Assurances
  // ----------------------------------------------------
  const createAssuranceMutation = useMutation({
    mutationFn: (body: any) => api.post('/sous-traitants/assurances', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sous-traitants-assurances'] });
      setShowAssuranceModal(false);
      resetAssuranceForm();
    },
  });

  const updateAssuranceMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => api.patch(`/sous-traitants/assurances/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sous-traitants-assurances'] });
      setShowAssuranceModal(false);
      setEditingAssurance(null);
      resetAssuranceForm();
    },
  });

  const deleteAssuranceMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sous-traitants/assurances/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sous-traitants-assurances'] }),
  });

  // ----------------------------------------------------
  // Helpers / Resets
  // ----------------------------------------------------
  const resetSTForm = () => setStForm({ nom: '', siret: '', email: '', telephone: '', adresse: '', specialite: '', statut: 'ACTIF' });
  const resetContratForm = () => setContratForm({ sousTraitantId: '', chantierId: '', reference: '', montantHT: '', statut: 'BROUILLON', dateDebut: '', dateFin: '' });
  const resetAssuranceForm = () => setAssuranceForm({ sousTraitantId: '', typeAssurance: 'RC_DECENNALE', numeroAttestation: '', compagnieAssurance: '', dateExpiration: '', statut: 'VALIDE' });

  const handleEditST = (st: SousTraitant) => {
    setEditingST(st);
    setStForm({
      nom: st.nom,
      siret: st.siret || '',
      email: st.email || '',
      telephone: st.telephone || '',
      adresse: st.adresse || '',
      specialite: st.specialite || '',
      statut: st.statut,
    });
    setShowSTModal(true);
  };

  const handleEditContrat = (c: ContratSousTraitant) => {
    setEditingContrat(c);
    setContratForm({
      sousTraitantId: String(c.sousTraitantId),
      chantierId: String(c.chantierId),
      reference: c.reference,
      montantHT: String(c.montantHT),
      statut: c.statut,
      dateDebut: c.dateDebut ? c.dateDebut.split('T')[0] : '',
      dateFin: c.dateFin ? c.dateFin.split('T')[0] : '',
    });
    setShowContratModal(true);
  };

  const handleEditAssurance = (a: AssuranceSousTraitant) => {
    setEditingAssurance(a);
    setAssuranceForm({
      sousTraitantId: String(a.sousTraitantId),
      typeAssurance: a.typeAssurance,
      numeroAttestation: a.numeroAttestation,
      compagnieAssurance: a.compagnieAssurance,
      dateExpiration: a.dateExpiration ? a.dateExpiration.split('T')[0] : '',
      statut: a.statut,
    });
    setShowAssuranceModal(true);
  };

  const handleSTSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = { ...stForm };
    if (editingST) {
      updateSTMutation.mutate({ id: editingST.id, body });
    } else {
      createSTMutation.mutate(body);
    }
  };

  const handleContratSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = {
      sousTraitantId: Number(contratForm.sousTraitantId),
      chantierId: Number(contratForm.chantierId),
      reference: contratForm.reference,
      montantHT: Number(contratForm.montantHT),
      statut: contratForm.statut,
    };
    if (contratForm.dateDebut) body.dateDebut = new Date(contratForm.dateDebut).toISOString();
    if (contratForm.dateFin) body.dateFin = new Date(contratForm.dateFin).toISOString();

    if (editingContrat) {
      updateContratMutation.mutate({ id: editingContrat.id, body });
    } else {
      createContratMutation.mutate(body);
    }
  };

  const handleAssuranceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = {
      sousTraitantId: Number(assuranceForm.sousTraitantId),
      typeAssurance: assuranceForm.typeAssurance,
      numeroAttestation: assuranceForm.numeroAttestation,
      compagnieAssurance: assuranceForm.compagnieAssurance,
      dateExpiration: new Date(assuranceForm.dateExpiration).toISOString(),
      statut: assuranceForm.statut,
    };

    if (editingAssurance) {
      updateAssuranceMutation.mutate({ id: editingAssurance.id, body });
    } else {
      createAssuranceMutation.mutate(body);
    }
  };

  const sousTraitantsList = stData ?? [];
  const contratsList = contratData ?? [];
  const assurancesList = assuranceData ?? [];
  const chantiersList = chantiersData ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="text-violet-600 w-6 h-6" />
            Gestion de la Sous-Traitance
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Suivi des sous-traitants, des contrats de chantiers et des attestations d'assurances.</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'sous-traitants' && (
            isAdmin && (
              <button
                onClick={() => { resetSTForm(); setEditingST(null); setShowSTModal(true); }}
                className="inline-flex items-center gap-2 batiflow-gradient text-white px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all font-medium text-sm"
              >
                <Plus size={17} /> Nouveau sous-traitant
              </button>
            )
          )}
          {activeTab === 'contrats' && (
            isAdmin && (
              <button
                onClick={() => { resetContratForm(); setEditingContrat(null); setShowContratModal(true); }}
                className="inline-flex items-center gap-2 batiflow-gradient text-white px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all font-medium text-sm"
              >
                <Plus size={17} /> Créer un contrat
              </button>
            )
          )}
          {activeTab === 'assurances' && (
            isAdmin && (
              <button
                onClick={() => { resetAssuranceForm(); setEditingAssurance(null); setShowAssuranceModal(true); }}
                className="inline-flex items-center gap-2 batiflow-gradient text-white px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all font-medium text-sm"
              >
                <Plus size={17} /> Ajouter une assurance
              </button>
            )
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('sous-traitants')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'sous-traitants'
              ? 'border-violet-600 text-violet-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Users size={16} /> Sous-traitants
          </span>
        </button>
        <button
          onClick={() => setActiveTab('contrats')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'contrats'
              ? 'border-violet-600 text-violet-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <FileText size={16} /> Contrats de chantiers
          </span>
        </button>
        <button
          onClick={() => setActiveTab('assurances')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'assurances'
              ? 'border-violet-600 text-violet-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Shield size={16} /> Assurances & Attestations
          </span>
        </button>
      </div>

      {/* Search Filter for Sous-traitants tab */}
      {activeTab === 'sous-traitants' && (
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou spécialité..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 text-sm transition-all outline-none"
          />
        </div>
      )}

      {/* Tab Contents */}
      {activeTab === 'sous-traitants' && (
        <>
          {loadingST ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
          ) : sousTraitantsList.length === 0 ? (
            <div className="text-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Users size={32} className="text-gray-300" /></div>
              <p className="text-lg font-semibold text-gray-700">Aucun sous-traitant enregistré</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sousTraitantsList.map((st) => (
                <div key={st.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${st.statut === 'ACTIF' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                      {st.statut}
                    </span>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button onClick={() => handleEditST(st)} className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"><Edit size={14} /></button>
                        <button onClick={() => { if(confirm('Supprimer ce sous-traitant ?')) deleteSTMutation.mutate(st.id); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>

                  <h3 className="font-bold text-lg text-gray-900 mb-1">{st.nom}</h3>
                  {st.specialite && <p className="text-sm font-medium text-violet-600 mb-3">{st.specialite}</p>}

                  <div className="space-y-1.5 text-sm text-gray-500 border-t border-gray-50 pt-3">
                    {st.siret && <p className="text-xs"><span className="font-semibold text-gray-700">SIRET :</span> {st.siret}</p>}
                    {st.email && <p className="truncate"><span className="font-semibold text-gray-700">Email :</span> {st.email}</p>}
                    {st.telephone && <p><span className="font-semibold text-gray-700">Tél :</span> {st.telephone}</p>}
                    {st.adresse && <p className="text-xs truncate"><span className="font-semibold text-gray-700">Adresse :</span> {st.adresse}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'contrats' && (
        <>
          {loadingContrats ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
          ) : contratsList.length === 0 ? (
            <div className="text-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><FileText size={32} className="text-gray-300" /></div>
              <p className="text-lg font-semibold text-gray-700">Aucun contrat de sous-traitance enregistré</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Référence</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Sous-traitant</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Chantier</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Montant HT</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Période</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                    {isAdmin && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contratsList.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900">{c.reference}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{c.sousTraitant?.nom ?? `ID #${c.sousTraitantId}`}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {c.chantier ? (
                          <div>
                            <span className="font-semibold text-gray-700">{c.chantier.reference}</span>
                            <span className="block text-xs text-gray-400">Client: {c.chantier.client?.prenom ?? ''} {c.chantier.client?.nom ?? ''}</span>
                          </div>
                        ) : `Chantier #${c.chantierId}`}
                      </td>
                      <td className="px-6 py-4 font-semibold text-violet-600">{formatCurrency(c.montantHT)}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {c.dateDebut ? formatDate(c.dateDebut) : '-'} au {c.dateFin ? formatDate(c.dateFin) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                          c.statut === 'BROUILLON' ? 'bg-gray-100 text-gray-700' :
                          c.statut === 'EN_COURS' ? 'bg-blue-50 text-blue-700' :
                          c.statut === 'TERMINE' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-rose-50 text-rose-700'
                        }`}>
                          {c.statut}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => handleEditContrat(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"><Edit size={14} /></button>
                            <button onClick={() => { if(confirm('Supprimer ce contrat ?')) deleteContratMutation.mutate(c.id); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'assurances' && (
        <>
          {loadingAssurances ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
          ) : assurancesList.length === 0 ? (
            <div className="text-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Shield size={32} className="text-gray-300" /></div>
              <p className="text-lg font-semibold text-gray-700">Aucune attestation d'assurance enregistrée</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Sous-traitant</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type d'assurance</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">N° Attestation</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Compagnie</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Expiration</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                    {isAdmin && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assurancesList.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900">{a.sousTraitant?.nom ?? `ID #${a.sousTraitantId}`}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <span className="font-semibold text-gray-800">{a.typeAssurance.replace('_', ' ')}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{a.numeroAttestation}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{a.compagnieAssurance}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(a.dateExpiration)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                          a.statut === 'VALIDE' ? 'bg-emerald-50 text-emerald-700' :
                          a.statut === 'A_RENOUVELER' ? 'bg-amber-50 text-amber-700' :
                          'bg-rose-50 text-rose-700'
                        }`}>
                          {a.statut === 'VALIDE' && <CheckCircle size={12} />}
                          {a.statut === 'A_RENOUVELER' && <AlertTriangle size={12} />}
                          {a.statut === 'EXPIREE' && <AlertCircle size={12} />}
                          {a.statut}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => handleEditAssurance(a)} className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"><Edit size={14} /></button>
                            <button onClick={() => { if(confirm('Supprimer cette attestation ?')) deleteAssuranceMutation.mutate(a.id); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ---------------------------------------------------- */}
      {/* Modals */}
      {/* ---------------------------------------------------- */}

      {/* 1. Modal Sous-traitant */}
      {showSTModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editingST ? 'Modifier le sous-traitant' : 'Nouveau sous-traitant'}</h2>
              <button onClick={() => setShowSTModal(false)} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">✕</button>
            </div>
            <form onSubmit={handleSTSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom de l'entreprise *</label>
                <input type="text" required value={stForm.nom} onChange={(e) => setStForm({ ...stForm, nom: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Spécialité</label>
                  <input type="text" value={stForm.specialite} onChange={(e) => setStForm({ ...stForm, specialite: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">SIRET</label>
                  <input type="text" value={stForm.siret} onChange={(e) => setStForm({ ...stForm, siret: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input type="email" value={stForm.email} onChange={(e) => setStForm({ ...stForm, email: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone</label>
                  <input type="text" value={stForm.telephone} onChange={(e) => setStForm({ ...stForm, telephone: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse</label>
                <input type="text" value={stForm.adresse} onChange={(e) => setStForm({ ...stForm, adresse: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Statut</label>
                <select value={stForm.statut} onChange={(e) => setStForm({ ...stForm, statut: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400">
                  <option value="ACTIF">ACTIF</option>
                  <option value="INACTIF">INACTIF</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowSTModal(false)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={createSTMutation.isPending || updateSTMutation.isPending} className="px-5 py-2.5 batiflow-gradient text-white rounded-xl text-sm font-semibold">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal Contrat */}
      {showContratModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editingContrat ? 'Modifier le contrat' : 'Nouveau contrat de sous-traitance'}</h2>
              <button onClick={() => setShowContratModal(false)} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">✕</button>
            </div>
            <form onSubmit={handleContratSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sous-traitant *</label>
                <select required value={contratForm.sousTraitantId} onChange={(e) => setContratForm({ ...contratForm, sousTraitantId: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400">
                  <option value="">Sélectionner un sous-traitant</option>
                  {sousTraitantsList.map((st) => (
                    <option key={st.id} value={st.id}>{st.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Chantier rattaché *</label>
                <select required value={contratForm.chantierId} onChange={(e) => setContratForm({ ...contratForm, chantierId: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400">
                  <option value="">Sélectionner un chantier</option>
                  {chantiersList.map((ch: any) => (
                    <option key={ch.id} value={ch.id}>{ch.reference} - {ch.client?.prenom} {ch.client?.nom}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Référence contrat *</label>
                  <input type="text" required value={contratForm.reference} onChange={(e) => setContratForm({ ...contratForm, reference: e.target.value })} placeholder="CONT-2026-XYZ" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Montant HT (€) *</label>
                  <input type="number" required value={contratForm.montantHT} onChange={(e) => setContratForm({ ...contratForm, montantHT: e.target.value })} placeholder="3000" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date début</label>
                  <input type="date" value={contratForm.dateDebut} onChange={(e) => setContratForm({ ...contratForm, dateDebut: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date fin</label>
                  <input type="date" value={contratForm.dateFin} onChange={(e) => setContratForm({ ...contratForm, dateFin: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Statut</label>
                <select value={contratForm.statut} onChange={(e) => setContratForm({ ...contratForm, statut: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400">
                  <option value="BROUILLON">BROUILLON</option>
                  <option value="EN_COURS">EN_COURS</option>
                  <option value="TERMINE">TERMINE</option>
                  <option value="RESILIE">RESILIE</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowContratModal(false)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={createContratMutation.isPending || updateContratMutation.isPending} className="px-5 py-2.5 batiflow-gradient text-white rounded-xl text-sm font-semibold">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal Assurance */}
      {showAssuranceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editingAssurance ? 'Modifier l\'attestation' : 'Ajouter une attestation d\'assurance'}</h2>
              <button onClick={() => setShowAssuranceModal(false)} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">✕</button>
            </div>
            <form onSubmit={handleAssuranceSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sous-traitant *</label>
                <select required value={assuranceForm.sousTraitantId} onChange={(e) => setAssuranceForm({ ...assuranceForm, sousTraitantId: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400">
                  <option value="">Sélectionner un sous-traitant</option>
                  {sousTraitantsList.map((st) => (
                    <option key={st.id} value={st.id}>{st.nom}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type d'assurance *</label>
                  <select value={assuranceForm.typeAssurance} onChange={(e) => setAssuranceForm({ ...assuranceForm, typeAssurance: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400">
                    <option value="RC_DECENNALE">RC DECENNALE</option>
                    <option value="RC_PROFESSIONNELLE">RC PROFESSIONNELLE</option>
                    <option value="AUTRE">AUTRE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">N° d'attestation *</label>
                  <input type="text" required value={assuranceForm.numeroAttestation} onChange={(e) => setAssuranceForm({ ...assuranceForm, numeroAttestation: e.target.value })} placeholder="DEC-2026-XYZ" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Compagnie d'assurance *</label>
                  <input type="text" required value={assuranceForm.compagnieAssurance} onChange={(e) => setAssuranceForm({ ...assuranceForm, compagnieAssurance: e.target.value })} placeholder="AXA Assurances" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date d'expiration *</label>
                  <input type="date" required value={assuranceForm.dateExpiration} onChange={(e) => setAssuranceForm({ ...assuranceForm, dateExpiration: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Statut de validation *</label>
                <select value={assuranceForm.statut} onChange={(e) => setAssuranceForm({ ...assuranceForm, statut: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400">
                  <option value="VALIDE">VALIDE (Valide)</option>
                  <option value="A_RENOUVELER">A_RENOUVELER (À renouveler)</option>
                  <option value="EXPIREE">EXPIREE (Expirée)</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAssuranceModal(false)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={createAssuranceMutation.isPending || updateAssuranceMutation.isPending} className="px-5 py-2.5 batiflow-gradient text-white rounded-xl text-sm font-semibold">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
