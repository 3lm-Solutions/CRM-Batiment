import {
  nettoyerTranscription,
  modeleTranscriptionParDefaut,
} from '../assistant/llm/transcription.client';
import { detectAudio } from './audio-type';

const pad = (head: number[] | string, offset = 0) => {
  const b = Buffer.alloc(32);
  const bytes = typeof head === 'string' ? [...head].map((c) => c.charCodeAt(0)) : head;
  bytes.forEach((x, i) => (b[offset + i] = x));
  return b;
};

describe('devis vocal — audio recordings (29/10)', () => {
  it('recognises the formats browsers record', () => {
    expect(detectAudio(pad([0x1a, 0x45, 0xdf, 0xa3]))?.ext).toBe('webm');
    expect(detectAudio(pad('OggS'))?.ext).toBe('ogg');
    expect(detectAudio(pad('ftyp', 4))?.ext).toBe('m4a');
    const wav = pad('RIFF');
    'WAVE'.split('').forEach((c, i) => (wav[8 + i] = c.charCodeAt(0)));
    expect(detectAudio(wav)?.ext).toBe('wav');
    expect(detectAudio(pad('ID3'))?.ext).toBe('mp3');
    expect(detectAudio(pad([0xff, 0xfb]))?.ext).toBe('mp3');
  });

  it('refuses anything else (image, text, too short)', () => {
    expect(detectAudio(pad([0xff, 0xd8, 0xff, 0xe0]))).toBeNull(); // JPEG
    expect(detectAudio(pad([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(detectAudio(pad('<html>'))).toBeNull();
    expect(detectAudio(Buffer.from('OggS'))).toBeNull();
  });

  it('drops the stock sentences Whisper invents on silence', () => {
    expect(nettoyerTranscription('Sous-titres réalisés par la communauté d’Amara.org')).toBe('');
    expect(nettoyerTranscription(' Merci. ')).toBe('');
    expect(nettoyerTranscription('  Rénovation   salle de bain 8 m² ')).toBe(
      'Rénovation salle de bain 8 m²',
    );
  });

  it('picks Whisper for Groq and OpenAI, nothing for an unknown provider', () => {
    expect(modeleTranscriptionParDefaut('https://api.groq.com/openai/v1')).toBe(
      'whisper-large-v3-turbo',
    );
    expect(modeleTranscriptionParDefaut(undefined)).toBe('whisper-1');
    expect(modeleTranscriptionParDefaut('https://api.x.ai/v1')).toBeNull();
  });
});
