import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { subscribeNotifications } from '@/lib/socket';
import { useAuth } from '../auth/auth-context';

interface Notification {
  id: number;
  type: string;
  niveau: 'INFO' | 'SUCCES' | 'ALERTE';
  titre: string;
  message: string;
  lien: string | null;
  lueAt: string | null;
  createdAt: string;
}

/** Bell with unread counter. New notifications arrive over socket.io and pop as a toast. */
export function NotificationsBell() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const count = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: async () => (await api.get<{ nonLues: number }>('/notifications/compteur')).data,
  });
  const list = useQuery({
    queryKey: ['notifications', 'list'],
    enabled: open,
    queryFn: async () => (await api.get<PaginatedResponse<Notification>>('/notifications', { params: { limit: 15 } })).data,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/lue`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/tout-lire'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    if (!token) return;
    return subscribeNotifications<Notification>(token, (n) => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      (n.niveau === 'ALERTE' ? toast.warning : toast.info)(n.titre, { description: n.message });
    });
  }, [token, qc]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (open && !panel.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const unread = count.data?.nonLues ?? 0;

  return (
    <div className="relative" ref={panel}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Notifications${unread ? ` (${unread} non lues)` : ''}`}
        className="relative flex size-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <Bell className="size-[17px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="font-semibold">Notifications</p>
            <button type="button" onClick={() => markAll.mutate()} disabled={!unread} className="flex items-center gap-1 text-xs font-medium text-brand-700 disabled:opacity-40">
              <CheckCheck className="size-4" /> Tout marquer comme lu
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {list.data?.data.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Aucune notification</li>}
            {list.data?.data.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.lueAt) markRead.mutate(n.id);
                    setOpen(false);
                    if (n.lien) navigate(n.lien);
                  }}
                  className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800', !n.lueAt && 'bg-brand-100/40 dark:bg-slate-800/60')}
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.lueAt ? 'bg-transparent' : n.niveau === 'ALERTE' ? 'bg-amber-500' : 'bg-brand-700')} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{n.titre}</span>
                    <span className="block text-sm text-slate-600 dark:text-slate-400">{n.message}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{formatDateTime(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
