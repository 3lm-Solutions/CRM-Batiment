import api from '@/lib/api';
import type { SousTraitantDocument } from './types';

export async function downloadSousTraitantDocument(
  document: Pick<SousTraitantDocument, 'id' | 'nom' | 'url'>,
) {
  if (/^https?:\/\//i.test(document.url)) {
    window.open(document.url, '_blank', 'noopener,noreferrer');
    return;
  }

  const response = await api.get<Blob>(
    `/sous-traitant/documents/${document.id}/download`,
    { responseType: 'blob' },
  );
  const objectUrl = URL.createObjectURL(response.data);
  const anchor = window.document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = document.nom;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
