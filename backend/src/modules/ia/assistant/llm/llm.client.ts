/** A chat message sent to the language model. */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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

export class LlmError extends Error {
  constructor(
    readonly type: 'LLM_INDISPONIBLE' | 'LLM_REPONSE_INVALIDE' | 'QUOTA',
    message: string,
  ) {
    super(message);
  }
}
