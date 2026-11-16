/**
 * Accepted upload types, identified by their first bytes ("magic numbers").
 * The browser-sent Content-Type and the file name are NOT trusted: a renamed .html or
 * .svg (scriptable) would otherwise be served back as an "image".
 */
export interface DetectedType {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  ext: 'jpg' | 'png' | 'webp' | 'pdf';
}

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  bytes.every((b, i) => buf[offset + i] === b);

export function detectFileType(buf: Buffer): DetectedType | null {
  if (buf.length < 12) return null;
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: 'image/png', ext: 'png' };
  // RIFF....WEBP
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8))
    return { mime: 'image/webp', ext: 'webp' };
  // %PDF-
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}

export const ACCEPTED_LABEL = 'JPG, PNG, WebP ou PDF';

/** Display name kept from the client: no path, no control characters, bounded length. */
export function sanitizeFileName(name: string | undefined, fallback: string): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? '';
  // \p{Cc}: control characters (U+0000–U+001F, U+007F–U+009F)
  const clean = base
    .replace(/[\p{Cc}"<>]/gu, '')
    .trim()
    .slice(0, 150);
  return clean || fallback;
}
