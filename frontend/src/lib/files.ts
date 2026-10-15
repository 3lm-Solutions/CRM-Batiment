import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from './api';

/** A stored file (bytes live in the server's storage directory, never in git). */
export interface Fichier {
  id: number;
  nom: string;
  mime: string;
  taille: number;
  createdAt: string;
}

/** Same limits as the API (StorageService). */
export const ACCEPTED_FILES = 'image/jpeg,image/png,image/webp,application/pdf';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function validateFile(file: File): string | null {
  if (!ACCEPTED_FILES.split(',').includes(file.type)) return 'Formats acceptés : JPG, PNG, WebP ou PDF.';
  if (file.size > MAX_FILE_BYTES) return 'Fichier trop volumineux (10 Mo maximum).';
  return null;
}

/** Upload one file; `chantierId` lets the people of that job site read it. */
export const useUploadFichier = () =>
  useMutation({
    mutationFn: async ({ file, chantierId }: { file: File; chantierId?: number }) => {
      const body = new FormData();
      body.append('file', file);
      if (chantierId) body.append('chantierId', String(chantierId));
      return (await api.post<Fichier>('/fichiers', body, { timeout: 120_000 })).data;
    },
  });

/**
 * Files are protected by the session token, so a plain <a href> can't open them:
 * the bytes are fetched with the token and shown through a temporary blob URL.
 * `path` defaults to the authenticated endpoint; public pages pass their own.
 */
export async function openFichier(id: number, path = `/fichiers/${id}/contenu`) {
  // Opened synchronously so the popup isn't blocked, filled once the bytes arrive
  const win = window.open('', '_blank');
  try {
    const res = await api.get<Blob>(path, { responseType: 'blob', timeout: 120_000 });
    const url = URL.createObjectURL(res.data);
    if (win) win.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    win?.close();
    toast.error(errorMessage(e));
  }
}

/** Object URL for an <img> thumbnail; the caller revokes it. */
export async function fichierObjectUrl(path: string) {
  const res = await api.get<Blob>(path, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
}
