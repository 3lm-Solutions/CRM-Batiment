import { MessageCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatWidget } from './ChatWidget';

/** Any button of the page can open the assistant: `openChat()` (e.g. "Estimer mes travaux"). */
const OPEN_EVENT = 'crm:open-chat';
// eslint-disable-next-line react-refresh/only-export-components
export const openChat = () => window.dispatchEvent(new Event(OPEN_EVENT));

const TEASER_KEY = 'crm.chat.teaser-ferme';

/** Company of the public chatbot: `?entreprise=` in the URL, else VITE_CHATBOT_COMPANY_ID, else 1. */
export function useChatCompanyId() {
  const { search } = useLocation();
  const fromUrl = Number(new URLSearchParams(search).get('entreprise'));
  return fromUrl > 0 ? fromUrl : Number(import.meta.env.VITE_CHATBOT_COMPANY_ID) || 1;
}

/**
 * Floating bubble (bottom-right) that opens the chatbot; full screen on phones.
 * A small message invites visitors with a works project to ask for a quote (leads → page Assistant IA).
 */
export function ChatLauncher({ teaser = 'Un projet de travaux ? Demandez votre devis gratuit 👋' }: { teaser?: string | null }) {
  const companyId = useChatCompanyId();
  const [open, setOpen] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // The invitation appears after a few seconds, once per browser session
  useEffect(() => {
    if (!teaser) return;
    let closed = false;
    try {
      closed = sessionStorage.getItem(TEASER_KEY) === '1';
    } catch {
      /* private mode */
    }
    if (closed) return;
    const t = setTimeout(() => setShowTeaser(true), 4000);
    return () => {
      clearTimeout(t);
    };
  }, [teaser]);

  const hideTeaser = () => {
    setShowTeaser(false);
    try {
      sessionStorage.setItem(TEASER_KEY, '1');
    } catch {
      /* private mode */
    }
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[600px] sm:max-h-[calc(100vh-8rem)] sm:w-[380px]">
          <ChatWidget companyId={companyId} onClose={() => setOpen(false)} className="h-full rounded-none sm:rounded-xl" />
        </div>
      )}

      {!open && showTeaser && teaser && (
        <div className="fixed bottom-24 right-6 z-40 flex max-w-[260px] items-start gap-2 rounded-2xl rounded-br-sm border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <button
            type="button"
            className="flex-1 text-left"
            onClick={() => {
              hideTeaser();
              setOpen(true);
            }}
          >
            {teaser}
          </button>
          <button type="button" onClick={hideTeaser} className="rounded-md p-0.5 text-slate-400 hover:text-slate-600" aria-label="Fermer le message">
            <X className="size-4" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          hideTeaser();
          setOpen((o) => !o);
        }}
        className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30 transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300"
        aria-label={open ? 'Fermer l’assistant' : 'Ouvrir l’assistant'}
        aria-expanded={open}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </>
  );
}

/** /chat — the chatbot alone, to embed in the company's website with an <iframe>. */
export function PublicChatPage() {
  const companyId = useChatCompanyId();
  return (
    <main className="flex h-screen items-center justify-center bg-gray-50 sm:p-4">
      <ChatWidget companyId={companyId} className="h-full w-full max-w-lg rounded-none sm:h-[640px] sm:rounded-xl" />
    </main>
  );
}
