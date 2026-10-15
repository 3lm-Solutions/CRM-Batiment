import { Bot, CheckCircle2, FileText, LoaderCircle, RotateCcw, Send, ThumbsDown, ThumbsUp, TriangleAlert, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Input, Textarea } from '@/components/ui';
import { errorMessage, toProblem } from '@/lib/api';
import { cn } from '@/lib/cn';
import { EMAIL_MESSAGE, isPhone, PHONE_MESSAGE } from '@/lib/validation';
import { chatApi, type ChatSessionRef, type Coordonnees } from './api';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  contenu: string;
  rated?: 'UTILE' | 'PAS_UTILE';
}

const storageKey = (companyId: number) => `crm.chat.${companyId}`;
const store = {
  get(companyId: number): ChatSessionRef | null {
    try {
      const raw = sessionStorage.getItem(storageKey(companyId));
      return raw ? (JSON.parse(raw) as ChatSessionRef) : null;
    } catch {
      return null;
    }
  },
  set(companyId: number, s: ChatSessionRef | null) {
    try {
      if (s) sessionStorage.setItem(storageKey(companyId), JSON.stringify(s));
      else sessionStorage.removeItem(storageKey(companyId));
    } catch {
      /* private mode: the conversation just isn't kept on reload */
    }
  },
};

let seq = 0;
const uid = () => `m${Date.now()}-${seq++}`;

/** "Demander un devis": the structured form (spec P0), validated on both sides. */
function DevisForm({ onSubmit, onCancel, busy, error }: { onSubmit: (c: Coordonnees) => void; onCancel: () => void; busy: boolean; error: string | null }) {
  const [f, setF] = useState({ nom: '', prenom: '', email: '', telephone: '', adresse: '', description: '' });
  const [local, setLocal] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.nom.trim()) return setLocal('Indiquez votre nom.');
    if (!f.email.trim() && !f.telephone.trim()) return setLocal('Indiquez un email ou un téléphone.');
    if (f.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.email.trim())) return setLocal(EMAIL_MESSAGE);
    if (f.telephone && !isPhone(f.telephone)) return setLocal(PHONE_MESSAGE);
    if (f.description.trim().length < 10) return setLocal('Décrivez votre projet en quelques mots.');
    setLocal(null);
    onSubmit({
      nom: f.nom.trim(),
      prenom: f.prenom.trim() || null,
      email: f.email.trim() || undefined,
      telephone: f.telephone.trim() || undefined,
      adresse: f.adresse.trim() || null,
      description: f.description.trim(),
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3 p-4" noValidate>
      <p className="text-sm font-semibold text-gray-800">Votre demande de devis gratuit</p>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Nom" required value={f.nom} onChange={set('nom')} autoComplete="family-name" />
        <Input label="Prénom" value={f.prenom} onChange={set('prenom')} autoComplete="given-name" />
      </div>
      <Input label="Téléphone" type="tel" value={f.telephone} onChange={set('telephone')} autoComplete="tel" />
      <Input label="Email" type="email" value={f.email} onChange={set('email')} autoComplete="email" />
      <Input label="Ville du chantier" value={f.adresse} onChange={set('adresse')} />
      <Textarea label="Votre projet" required rows={3} value={f.description} onChange={set('description')} placeholder="Ex. : refaire une salle de bain de 6 m² avec douche à l’italienne" />
      {(local || error) && <p role="alert" className="text-xs font-medium text-red-600">{local ?? error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Retour</Button>
        <Button type="submit" size="sm" loading={busy}>Envoyer ma demande</Button>
      </div>
      <p className="text-[11px] text-gray-400">Vos données servent uniquement à traiter votre demande.</p>
    </form>
  );
}

/**
 * Public chatbot (spec P3): loading, errors, empty conversation, quick suggestions, responsive,
 * history kept during the browser session, "Nouvelle conversation".
 */
export function ChatWidget({ companyId, onClose, className }: { companyId: number; onClose?: () => void; className?: string }) {
  const [session, setSession] = useState<ChatSessionRef | null>(() => store.get(companyId));
  const [entreprise, setEntreprise] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ text: string; retry?: () => void } | null>(null);
  const [form, setForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  // React StrictMode runs effects twice in dev: never open two conversations
  const started = useRef(false);

  const begin = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const s = await chatApi.start(companyId);
      const ref = { sessionId: s.sessionId, token: s.token };
      store.set(companyId, ref);
      setSession(ref);
      setEntreprise(s.entreprise);
      setMessages([{ id: uid(), role: 'assistant', contenu: s.message }]);
      setSuggestions(s.suggestions);
      setEnregistre(false);
    } catch (e) {
      setError({ text: errorMessage(e), retry: () => void begin() });
    } finally {
      setPending(false);
    }
  }, [companyId]);

  // Resume the conversation of this browser session, or start one
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const saved = store.get(companyId);
    if (!saved) {
      void begin();
      return;
    }
    let cancelled = false;
    setPending(true);
    chatApi
      .history(saved)
      .then((h) => {
        if (cancelled) return;
        setMessages(h.messages.map((m) => ({ id: `h${m.id}`, role: m.role, contenu: m.contenu })));
        setEnregistre(h.prospectEnregistre);
        setSuggestions(h.prospectEnregistre ? [] : ['Demander un devis', 'Parler à un conseiller']);
      })
      .catch(() => {
        // Expired or unknown conversation: start a new one silently
        store.set(companyId, null);
        if (!cancelled) void begin();
      })
      .finally(() => !cancelled && setPending(false));
    return () => {
      cancelled = true;
      started.current = false;
    };
  }, [companyId, begin]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, pending, form]);

  const send = async (text: string) => {
    const contenu = text.trim();
    if (!contenu || !session || pending) return;
    if (contenu === 'Demander un devis' && !enregistre) {
      setForm(true);
      return;
    }
    setInput('');
    setError(null);
    setMessages((m) => [...m, { id: uid(), role: 'user', contenu }]);
    setPending(true);
    try {
      const r = await chatApi.send(session, contenu);
      setMessages((m) => [...m, { id: uid(), role: 'assistant', contenu: r.reponse }]);
      setSuggestions(r.suggestions);
      setEnregistre(r.prospectEnregistre);
    } catch (e) {
      const p = toProblem(e);
      if (p.status === 404 || p.status === 410) {
        store.set(companyId, null);
        setError({ text: 'Cette conversation a expiré.', retry: () => void begin() });
      } else {
        // Message kept on screen: the visitor can resend it
        setError({ text: p.status === 429 ? 'Trop de messages en peu de temps. Patientez une minute.' : p.message, retry: () => void retrySend(contenu) });
      }
    } finally {
      setPending(false);
    }
  };

  const retrySend = async (contenu: string) => {
    setMessages((m) => {
      const i = m.map((x) => x.contenu).lastIndexOf(contenu);
      return i >= 0 ? m.filter((_, j) => j !== i) : m;
    });
    await send(contenu);
  };

  const submitForm = async (c: Coordonnees) => {
    if (!session) return;
    setPending(true);
    setFormError(null);
    try {
      const r = await chatApi.coordonnees(session, c);
      setForm(false);
      setMessages((m) => [...m, { id: uid(), role: 'user', contenu: 'Demande de devis envoyée' }, { id: uid(), role: 'assistant', contenu: r.reponse }]);
      setSuggestions(r.suggestions);
      setEnregistre(true);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  const rate = (msg: Msg, rating: 'UTILE' | 'PAS_UTILE') => {
    if (!session || msg.rated) return;
    setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, rated: rating } : x)));
    void chatApi.feedback(session, rating, msg.contenu).catch(() => undefined);
  };

  const restart = () => {
    store.set(companyId, null);
    setForm(false);
    void begin();
  };

  return (
    <section className={cn('flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5', className)} aria-label="Assistant en ligne">
      <header className="flex items-center gap-3 bg-blue-600 px-4 py-3 text-white">
        <span className="flex size-9 items-center justify-center rounded-full bg-white/20"><Bot className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{entreprise || 'Assistant'}</p>
          <p className="text-xs text-blue-100">Répond en quelques secondes · devis gratuit</p>
        </div>
        <button type="button" onClick={restart} className="rounded-lg p-1.5 text-blue-100 hover:bg-white/15 hover:text-white" title="Nouvelle conversation" aria-label="Nouvelle conversation">
          <RotateCcw className="size-4" />
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-blue-100 hover:bg-white/15 hover:text-white" aria-label="Fermer l’assistant">
            <X className="size-5" />
          </button>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4" aria-live="polite">
        {messages.length === 0 && !pending && !error && (
          <p className="py-10 text-center text-sm text-gray-400">Posez votre question ou décrivez votre projet.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className="max-w-[85%]">
              <div
                className={cn(
                  'whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                  m.role === 'user' ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm border border-gray-100 bg-white text-gray-800 shadow-sm',
                )}
              >
                {m.contenu}
              </div>
              {m.role === 'assistant' && !m.id.startsWith('h') && messages.indexOf(m) > 0 && (
                <div className="mt-1 flex gap-1 pl-1 text-gray-400">
                  <button type="button" onClick={() => rate(m, 'UTILE')} disabled={!!m.rated} className={cn('rounded p-0.5 hover:text-green-600', m.rated === 'UTILE' && 'text-green-600')} aria-label="Réponse utile">
                    <ThumbsUp className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => rate(m, 'PAS_UTILE')} disabled={!!m.rated} className={cn('rounded p-0.5 hover:text-red-600', m.rated === 'PAS_UTILE' && 'text-red-600')} aria-label="Réponse pas utile">
                    <ThumbsDown className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && !form && (
          <div className="flex justify-start" role="status" aria-label="L’assistant écrit">
            <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-gray-100 bg-white px-4 py-3 shadow-sm">
              {[0, 150, 300].map((d) => <span key={d} className="size-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: `${d}ms` }} />)}
            </div>
          </div>
        )}
        {enregistre && !form && (
          <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-green-700"><CheckCircle2 className="size-4" /> Demande transmise à un conseiller</p>
        )}
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div className="flex-1">
              {error.text}
              {error.retry && <button type="button" onClick={error.retry} className="ml-2 font-semibold underline">Réessayer</button>}
            </div>
          </div>
        )}
        {form && (
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <DevisForm onSubmit={(c) => void submitForm(c)} onCancel={() => setForm(false)} busy={pending} error={formError} />
          </div>
        )}
        <div ref={end} />
      </div>

      {!form && (
        <>
          {suggestions.length > 0 && (
            <div className="flex gap-2 overflow-x-auto border-t border-gray-100 bg-white px-3 pt-3">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => void send(s)}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  {s === 'Demander un devis' && <FileText className="size-3.5" aria-hidden />}
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-2 bg-white p-3"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Écrivez votre message…"
              aria-label="Votre message"
              disabled={!session}
              className="max-h-28 min-h-10 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <button
              type="submit"
              disabled={!input.trim() || pending || !session}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              aria-label="Envoyer"
            >
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </form>
        </>
      )}
      <p className="bg-white pb-2 text-center text-[10px] text-gray-400">Assistant automatique : aucun prix n’est donné ici, un conseiller établit votre devis.</p>
    </section>
  );
}
