import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ExternalLink, MapPin, Save, Trash2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import api from "@/lib/api";

interface Person {
  id: number;
  nom: string;
  prenom: string;
  email?: string;
}
interface ChantierDetail {
  id: number;
  reference: string;
  adresse: string;
  description?: string;
  notes?: string;
  statut: string;
  dateDebut?: string;
  dateFin?: string;
  createdAt: string;
  updatedAt: string;
  client: Person;
  chefChantier?: Person;
  devis: { id: number; reference: string; statut: string; totalTTC: number }[];
  taches: { id: number; libelle: string; statut: string; avancement: number }[];
  documents: { id: number; nom: string; type: string; url: string }[];
  sousTraitantsVisibles: Person[];
}
interface SousTraitant {
  id: number;
  nom: string;
  prenom: string;
  email: string;
}
interface AssignmentOptions {
  sousTraitants: SousTraitant[];
}

export default function ChantierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const detailQuery = useQuery<ChantierDetail>({
    queryKey: ["chantier", id],
    queryFn: async () => (await api.get(`/chantiers/${id}`)).data,
    enabled: Boolean(id),
  });
  const usersQuery = useQuery<SousTraitant[]>({
    queryKey: ["chantier-sharing-options"],
    queryFn: async () =>
      (await api.get<AssignmentOptions>("/chantiers/assignation-options")).data
        .sousTraitants,
  });
  const removePlanMutation = useMutation({
    mutationFn: async () => api.delete(`/chantiers/${id}/plan-2d`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chantier", id] });
    },
  });
  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch(`/chantiers/${id}/sous-traitants`, {
        sousTraitantIds: selectedIds,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["chantier", id] }),
  });
  useEffect(() => {
    if (detailQuery.data)
      setSelectedIds(
        detailQuery.data.sousTraitantsVisibles.map((item) => item.id),
      );
  }, [detailQuery.data]);

  if (detailQuery.isLoading)
    return <p className="text-sm text-slate-500">Loading chantier...</p>;
  if (detailQuery.error)
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Unable to load this chantier. The backend may need the latest database
        migration.
      </div>
    );
  if (!detailQuery.data)
    return <p className="text-sm text-slate-500">Chantier not found.</p>;
  const chantier = detailQuery.data;
  const toggle = (userId: number) =>
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((idValue) => idValue !== userId)
        : [...current, userId],
    );

  return (
    <div className="space-y-6">
      <Link
        to="/admin/chantiers"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to chantiers
      </Link>
      <section className="rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-600">
              Chantier details
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {chantier.reference}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-slate-600">
              <MapPin size={16} /> {chantier.adresse}
            </p>
          </div>
          <Link
            to={`/admin/chantiers/${chantier.id}/plan-2d`}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Open 2D design <ExternalLink size={15} />
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <p className="font-semibold text-slate-900">{chantier.statut}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Client</p>
            <p className="font-semibold text-slate-900">
              {chantier.client.prenom} {chantier.client.nom}
            </p>
            <p className="text-sm text-slate-500">{chantier.client.email}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Site manager</p>
            <p className="font-semibold text-slate-900">
              {chantier.chefChantier
                ? `${chantier.chefChantier.prenom} ${chantier.chefChantier.nom}`
                : "Not assigned"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Dates</p>
            <p className="font-semibold text-slate-900">
              {chantier.dateDebut?.slice(0, 10) || "-"} to{" "}
              {chantier.dateFin?.slice(0, 10) || "-"}
            </p>
          </div>
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Description and notes
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {chantier.description || "No description."}
          </p>
          {chantier.notes && (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              {chantier.notes}
            </p>
          )}
          <h3 className="mt-6 font-semibold text-slate-900">
            Tasks ({chantier.taches.length})
          </h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-600">
            {chantier.taches.slice(0, 8).map((task) => (
              <li
                key={task.id}
                className="flex justify-between border-b border-slate-100 py-2"
              >
                <span>{task.libelle}</span>
                <span>{task.avancement}%</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Sous-traitant access
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Choose who can see this chantier and its 2D design.
              </p>
            </div>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={15} /> Save access
            </button>
          </div>
          <div className="mt-5 space-y-2">
            {usersQuery.data?.map((user) => (
              <label
                key={user.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-blue-100 bg-white px-3 py-3"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(user.id)}
                  onChange={() => toggle(user.id)}
                  className="h-4 w-4 accent-blue-600"
                />
                <span>
                  <span className="block font-semibold text-slate-900">
                    {user.prenom} {user.nom}
                  </span>
                  <span className="text-xs text-slate-500">{user.email}</span>
                </span>
                {selectedIds.includes(user.id) && (
                  <Check size={16} className="ml-auto text-blue-600" />
                )}
              </label>
            ))}
            {usersQuery.data?.length === 0 && (
              <p className="text-sm text-slate-500">
                No active sous-traitants found.
              </p>
            )}
          </div>
          {saveMutation.isSuccess && (
            <p className="mt-4 text-sm font-semibold text-emerald-700">
              Access updated.
            </p>
          )}
        </section>
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Documents and quotes
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {chantier.documents.map((document) => (
            <div
              key={document.id}
              className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700"
            >
              <a
                href={document.url}
                target="_blank"
                rel="noreferrer"
                className="block hover:text-slate-900"
              >
                {document.type === 'PLAN_2D' && document.url.startsWith('data:image/') ? (
                  <img
                    src={document.url}
                    alt={document.nom}
                    className="mb-2 h-32 w-full rounded-lg object-contain bg-slate-50"
                  />
                ) : null}
                <span className="font-medium">{document.nom}</span>
                {document.type === 'PLAN_2D' ? (
                  <span className="mt-1 block text-xs text-emerald-600">
                    Open PNG preview
                  </span>
                ) : null}
              </a>
              {document.type === 'PLAN_2D' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Supprimer le plan 2D de ce chantier ?')) {
                      removePlanMutation.mutate();
                    }
                  }}
                  disabled={removePlanMutation.isPending}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {removePlanMutation.isPending ? 'Suppression...' : 'Supprimer le plan 2D'}
                </button>
              ) : null}
            </div>
          ))}
          {chantier.devis.map((devis) => (
            <div
              key={devis.id}
              className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700"
            >
              Quote {devis.reference} · {devis.statut}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
