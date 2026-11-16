import OpenAI, { toFile } from 'openai';
import { LlmError } from './llm.client';

/**
 * Speech to text (29/10 — « devis vocal »): the recording made in the browser is sent to the
 * server, which asks a Whisper model for the text. Works in every browser (the browser's own
 * dictation needs Google's service and is missing in Firefox).
 */
export interface TranscriptionClient {
  readonly model: string;
  /** Returns the recognised text (may be empty), or throws LlmError. */
  transcrire(audio: Buffer, fileName: string, mime: string): Promise<string>;
}

/** null = no key or no transcription model for this provider: the « Dicter » button says so. */
export const TRANSCRIPTION_CLIENT = Symbol('TRANSCRIPTION_CLIENT');

/**
 * Words Whisper should expect (it guesses rare words better with a hint). Short on purpose:
 * the prompt is limited to ~224 tokens.
 */
const VOCABULAIRE =
  'Description de travaux de bâtiment pour un devis : dépose, carrelage, faïence, plinthes, ragréage, chape, placo, BA13, enduit, peinture, douche à l’italienne, receveur, mitigeur, WC suspendu, VMC, tableau électrique, prises, mètres carrés, mètres linéaires.';

/** Model used when OPENAI_TRANSCRIPTION_MODEL is empty: Groq and OpenAI both offer Whisper. */
export function modeleTranscriptionParDefaut(baseUrl: string | undefined): string | null {
  if (!baseUrl || baseUrl.includes('api.openai.com')) return 'whisper-1';
  if (baseUrl.includes('groq.com')) return 'whisper-large-v3-turbo';
  return null; // other providers (xAI…): set OPENAI_TRANSCRIPTION_MODEL if they offer one
}

/**
 * Whisper sometimes « hears » a stock sentence in a silent or very noisy recording (subtitles
 * credits learnt from videos). Such an answer means: nothing was said.
 */
const PHRASES_FANTOMES = [
  /amara\.org/i,
  /sous-titr/i,
  /merci d.avoir regard/i,
  /abonnez-vous/i,
  /^\W*(merci|thank you)\W*$/i,
];

export function nettoyerTranscription(texte: string): string {
  const t = texte.replace(/\s+/g, ' ').trim();
  return PHRASES_FANTOMES.some((r) => r.test(t)) ? '' : t;
}

export class OpenAiTranscriptionClient implements TranscriptionClient {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    timeoutMs: number,
    baseURL?: string,
  ) {
    this.client = new OpenAI({ apiKey, baseURL, timeout: timeoutMs, maxRetries: 1 });
  }

  async transcrire(audio: Buffer, fileName: string, mime: string): Promise<string> {
    try {
      const res = await this.client.audio.transcriptions.create({
        file: await toFile(audio, fileName, { type: mime }),
        model: this.model,
        language: 'fr',
        prompt: VOCABULAIRE,
        response_format: 'json',
        temperature: 0,
      });
      return nettoyerTranscription(res.text ?? '');
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 429)
        throw new LlmError('QUOTA', 'Limite de requêtes de transcription atteinte');
      const detail = error instanceof Error ? error.message.replace(/\s+/g, ' ').slice(0, 300) : '';
      throw new LlmError(
        'LLM_INDISPONIBLE',
        status
          ? `Transcription HTTP ${status} (${this.model})${detail ? ` : ${detail}` : ''}`
          : detail || 'erreur réseau',
      );
    }
  }
}
