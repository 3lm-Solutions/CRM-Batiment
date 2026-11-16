import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';

function buildSocketUrl() {
  const configured = import.meta.env.VITE_WS_URL?.trim();
  const baseUrl = (configured || 'http://localhost:3000').replace(/\/+$/, '');

  return baseUrl.endsWith('/notifications')
    ? baseUrl
    : `${baseUrl}/notifications`;
}

export default function RealtimeEventsBridge() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token || !user) return undefined;

    const socket = io(buildSocketUrl(), {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    const refreshNotifications = () => {
      queryClient.invalidateQueries({ queryKey: ['internal-notifications'] });
    };

    const refreshDemo = () => {
      refreshNotifications();
      queryClient.invalidateQueries({ queryKey: ['demo-requests'] });
      queryClient.invalidateQueries({ queryKey: ['demo-requests-summary'] });
    };

    const refreshSav = () => {
      refreshNotifications();
      queryClient.invalidateQueries({ queryKey: ['sav-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['sav-summary'] });
    };

    const refreshSousTraitantDocuments = () => {
      refreshNotifications();
      queryClient.invalidateQueries({ queryKey: ['sous-traitant-documents'] });
      queryClient.invalidateQueries({ queryKey: ['sous-traitant-chantiers'] });
      queryClient.invalidateQueries({ queryKey: ['sous-traitant-dashboard'] });
    };

    const refreshStock = () => {
      refreshNotifications();
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    };

    socket.on('notifications:changed', refreshNotifications);
    socket.on('demo:changed', refreshDemo);
    socket.on('sav:changed', refreshSav);
    socket.on('sous-traitant:documents-changed', refreshSousTraitantDocuments);
    socket.on('stock:changed', refreshStock);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [queryClient, token, user]);

  return null;
}
