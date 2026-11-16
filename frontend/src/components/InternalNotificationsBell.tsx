import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { InternalNotificationsResponse, Role } from '@/types';

const allowedRoles: Role[] = ['ADMIN', 'ASSISTANTE', 'CHEF_CHANTIER', 'TECHNICO'];

const levelStyles = {
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
} as const;

const playNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    gain1.gain.setValueAtTime(0, audioCtx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    
    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 0.16);
    
    setTimeout(() => {
      try {
        const audioCtx2 = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc2 = audioCtx2.createOscillator();
        const gain2 = audioCtx2.createGain();
        
        osc2.connect(gain2);
        gain2.connect(audioCtx2.destination);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, audioCtx2.currentTime); // A5
        gain2.gain.setValueAtTime(0, audioCtx2.currentTime);
        gain2.gain.linearRampToValueAtTime(0.1, audioCtx2.currentTime + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx2.currentTime + 0.25);
        
        osc2.start(audioCtx2.currentTime);
        osc2.stop(audioCtx2.currentTime + 0.26);
      } catch (e) {
        console.warn(e);
      }
    }, 120);
  } catch (err) {
    console.warn('AudioContext failed to start:', err);
  }
};

export default function InternalNotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const [activeToast, setActiveToast] = useState<{ id: number; title: string; message: string; category: string; actorName?: string } | null>(null);

  const newestSeenIdKey = user ? `internal-notifications-newest-seen-id-${user.id}` : null;
  const [lastSeenId, setLastSeenId] = useState<number>(() => {
    const val = newestSeenIdKey ? localStorage.getItem(newestSeenIdKey) : null;
    return val ? parseInt(val, 10) : 0;
  });
  const canUseNotifications = Boolean(user && allowedRoles.includes(user.role));

  const notificationsQuery = useQuery({
    queryKey: ['internal-notifications', user?.id],
    enabled: canUseNotifications,
    refetchInterval: 30000,
    queryFn: async () => {
      const response = await api.get<InternalNotificationsResponse>(
        '/notifications/internal',
        { params: { limit: 8 } },
      );
      return response.data;
    },
  });

  const items = useMemo(
    () => notificationsQuery.data?.items ?? [],
    [notificationsQuery.data?.items],
  );

  const newestId = items[0]?.id ?? null;
  const [prevNewestId, setPrevNewestId] = useState<number | null>(null);

  useEffect(() => {
    if (newestId !== null) {
      if (prevNewestId !== null && newestId > prevNewestId) {
        playNotificationSound();
        const newNotif = items.find((item) => item.id === newestId);
        if (newNotif) {
          const actorName = newNotif.actor
            ? `${newNotif.actor.prenom} ${newNotif.actor.nom}`
            : undefined;
          setActiveToast({
            id: newNotif.id,
            title: newNotif.title,
            message: newNotif.message,
            category: newNotif.category,
            actorName,
          });
        }
      }
      setPrevNewestId(newestId);
    }
  }, [newestId, prevNewestId, items]);

  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  const unreadCount = useMemo(() => {
    return items.filter((item) => item.id > lastSeenId).length;
  }, [items, lastSeenId]);

  const handleToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen && newestId !== null && newestSeenIdKey) {
      localStorage.setItem(newestSeenIdKey, String(newestId));
      setLastSeenId(newestId);
    }
  };

  if (!canUseNotifications) return null;

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100/80 text-gray-500 transition-colors hover:bg-gray-200/80 hover:text-gray-700"
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
            {Math.min(unreadCount, 9)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[360px] overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl">
          <div className="border-b border-stone-200 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-900">Notifications internes</p>
                <p className="text-xs text-slate-500">
                  Mises a jour fournisseur et receptions chantier
                </p>
              </div>
              {notificationsQuery.isFetching ? (
                <Loader2 size={16} className="animate-spin text-slate-400" />
              ) : null}
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notificationsQuery.isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-2xl bg-stone-100" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                Aucune notification recente.
              </div>
            ) : (
              <div className="space-y-3 p-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                          levelStyles[item.level],
                        )}
                      >
                        {item.category}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {item.message}
                    </p>
                    {item.actor ? (
                      <p className="mt-2 text-xs text-slate-400">
                        Par {item.actor.prenom} {item.actor.nom}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {notificationsQuery.data ? (
            <div className="border-t border-stone-200 bg-stone-50 px-4 py-3 text-xs text-slate-500">
              {notificationsQuery.data.summary.total} notification(s) chargee(s)
            </div>
          ) : null}
        </div>
      ) : null}

      {activeToast && createPortal(
        <div 
          className="fixed bottom-6 right-6 z-[99999] w-[360px] animate-slide-in rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_15px_40px_rgba(0,0,0,0.18)] transition-all duration-300 cursor-pointer border-l-4 border-l-blue-600"
          onClick={() => {
            setOpen(true);
            if (newestId !== null && newestSeenIdKey) {
              localStorage.setItem(newestSeenIdKey, String(newestId));
              setLastSeenId(newestId);
            }
            setActiveToast(null);
          }}
        >
          <div className="flex items-start gap-3">
            {/* Icône avatar style */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Bell size={18} className="animate-swing" />
            </div>

            {/* Contenu */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  {activeToast.category}
                </span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveToast(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-xs font-semibold px-1"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-900 truncate">
                {activeToast.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {activeToast.message}
              </p>
              {activeToast.actorName && (
                <p className="mt-1 text-[10px] text-slate-400">
                  Par {activeToast.actorName}
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(120%) scale(0.9);
            opacity: 0;
          }
          to {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }

        .animate-slide-in {
          animation: slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes swing {
          0%, 100% { transform: rotate(0); }
          20% { transform: rotate(15deg); }
          40% { transform: rotate(-10deg); }
          60% { transform: rotate(5deg); }
          80% { transform: rotate(-5deg); }
        }

        .animate-swing {
          animation: swing 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
