import axios, { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/shared';
import { authStorage } from './auth-storage';

/**
 * The ONLY http client. Pages never call axios directly: they use the hooks in
 * features/<domain>/api.ts, which use this instance.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  const token = authStorage.getToken();
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Called on 401 (session expired, account deactivated, password changed elsewhere). */
let onSessionExpired: () => void = () => undefined;
export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler;
};

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const url = error.config?.url ?? '';
    // Public routes (login, client link) handle their own 401/404
    const isPublicCall = url.includes('/auth/') || url.includes('/public/');
    if (error.response?.status === 401 && !isPublicCall && authStorage.getToken()) {
      authStorage.clear();
      onSessionExpired();
    }
    return Promise.reject(error);
  },
);

/** Normalised API error, built from the backend's standard error format. */
export interface ApiProblem {
  status: number;
  code?: string;
  message: string;
  requestId?: string;
}

/** When the server gives no message of its own (proxy error, server down…). */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Certaines informations sont invalides. Vérifiez le formulaire.',
  401: 'Votre session a expiré. Reconnectez-vous.',
  403: 'Vous n’avez pas les droits pour cette action.',
  404: 'Élément introuvable : il a peut-être été supprimé.',
  409: 'Cette opération entre en conflit avec des données existantes.',
  410: 'Ce lien a expiré ou a été désactivé.',
  413: 'Fichier trop volumineux.',
  422: 'Action impossible dans l’état actuel.',
  429: 'Trop de demandes en peu de temps. Patientez une minute puis réessayez.',
  500: 'Erreur du serveur. Réessayez dans un instant ; si cela continue, prévenez l’administrateur.',
  502: 'Le serveur ne répond pas. Réessayez dans un instant.',
  503: 'Service momentanément indisponible. Réessayez dans un instant.',
  504: 'Le serveur met trop de temps à répondre. Réessayez.',
};

export function toProblem(error: unknown): ApiProblem {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return { status: 0, message: 'Le serveur met trop de temps à répondre. Réessayez.' };
    }
    if (!error.response) return { status: 0, message: 'Serveur injoignable. Vérifiez votre connexion ou que l’API est démarrée.' };
    const data = error.response.data as ApiErrorResponse | undefined;
    const status = error.response.status;
    const fromServer = Array.isArray(data?.message) ? data.message.join(' · ') : data?.message;
    const message = fromServer || STATUS_MESSAGES[status] || (status >= 500 ? STATUS_MESSAGES[500] : 'La demande n’a pas abouti.');
    return { status, code: data?.code, message, requestId: data?.requestId };
  }
  return { status: 0, message: 'Erreur inattendue. Rechargez la page et réessayez.' };
}

export const errorMessage = (error: unknown) => toProblem(error).message;
