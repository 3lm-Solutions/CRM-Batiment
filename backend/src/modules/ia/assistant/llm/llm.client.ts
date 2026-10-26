/** A chat message sent to the language model. */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /**
   * Photos sent with a user message, as data URLs (`data:image/jpeg;base64,…`) — quote from a
   * photo, C37 of 21/10. The model must read images (gpt-4o-mini, gpt-4o… do).
   */
  images?: string[];
}

/** JSON schema the model must follow (OpenAI "structured outputs"). */
export interface LlmJsonSchema {
  name: string;
  schema: Record<string, unknown>;
}

/** Per-call settings (the chatbot keeps the defaults; quote drafting needs longer answers). */
export interface LlmOptions {
  /** Default 700 */
  maxTokens?: number;
  /** Overrides OPENAI_TIMEOUT_MS for a slow call (image analysis) */
  timeoutMs?: number;
}

/**
 * The only thing the assistant needs from an AI provider. OpenAI today; another provider means
 * one more class implementing this interface. Tests inject a fake (no network, no cost).
 */
export interface LlmClient {
  readonly name: string;
  /** Returns the parsed JSON object, or throws LlmError. */
  completeJson(messages: LlmMessage[], schema: LlmJsonSchema, options?: LlmOptions): Promise<unknown>;
}

/** null = no API key configured: the assistant runs in guided mode. */
export const LLM_CLIENT = Symbol('LLM_CLIENT');

/**
 * Model that reads images (quote from a photo, C37 of 21/10). null = OPENAI_VISION_MODEL not set:
 * the « Photo » tab says so. Separate from LLM_CLIENT because many text models (gpt-oss…) refuse images.
 */
export const LLM_VISION_CLIENT = Symbol('LLM_VISION_CLIENT');

export class LlmError extends Error {
  constructor(
    readonly type: 'LLM_INDISPONIBLE' | 'LLM_REPONSE_INVALIDE' | 'QUOTA',
    message: string,
  ) {
    super(message);
  }
}
