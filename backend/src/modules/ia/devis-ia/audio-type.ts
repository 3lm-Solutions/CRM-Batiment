/**
 * Audio recordings accepted for the « devis vocal » (29/10), recognised by their first bytes
 * (the Content-Type sent by the browser is not trusted). Chrome / Edge / Firefox record WebM or
 * Ogg (Opus), Safari / iPhone record MP4 (M4A).
 */
export interface AudioType {
  mime: 'audio/webm' | 'audio/ogg' | 'audio/mp4' | 'audio/mpeg' | 'audio/wav';
  ext: 'webm' | 'ogg' | 'm4a' | 'mp3' | 'wav';
}

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf: Buffer, text: string, offset = 0) =>
  startsWith(
    buf,
    [...text].map((c) => c.charCodeAt(0)),
    offset,
  );

export function detectAudio(buf: Buffer): AudioType | null {
  if (buf.length < 12) return null;
  // EBML header (Matroska / WebM)
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: 'audio/webm', ext: 'webm' };
  if (ascii(buf, 'OggS')) return { mime: 'audio/ogg', ext: 'ogg' };
  // ISO base media: ....ftyp
  if (ascii(buf, 'ftyp', 4)) return { mime: 'audio/mp4', ext: 'm4a' };
  if (ascii(buf, 'RIFF') && ascii(buf, 'WAVE', 8)) return { mime: 'audio/wav', ext: 'wav' };
  // MP3: ID3 tag, or an MPEG audio frame sync (11 bits set)
  if (ascii(buf, 'ID3') || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0))
    return { mime: 'audio/mpeg', ext: 'mp3' };
  return null;
}

export const AUDIO_ACCEPTE = 'WebM, Ogg, MP4 / M4A, MP3 ou WAV';
