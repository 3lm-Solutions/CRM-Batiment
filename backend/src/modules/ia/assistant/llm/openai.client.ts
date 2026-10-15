import OpenAI from 'openai';
import { LlmError, type LlmClient, type LlmJsonSchema, type LlmMessage, type LlmOptions } from './llm.client';

/** OpenAI chat completions with a strict JSON schema (spec: "NestJS + OpenAI SDK"). */
export class OpenAiLlmClient implements LlmClient {
  readonly name = 'openai';
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    timeoutMs: number,
    baseURL?: string,
  ) {
    // One retry on network errors / 5xx; the visitor should not wait more than ~2 × timeout.
    // baseURL: any OpenAI-compatible API (xAI Grok…); undefined = OpenAI.
    this.client = new OpenAI({ apiKey, baseURL, timeout: timeoutMs, maxRetries: 1 });
  }

  async completeJson(messages: LlmMessage[], schema: LlmJsonSchema, options: LlmOptions = {}): Promise<unknown> {
    let content: string | null | undefined;
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages,
        // Reasoning models (o-series, gpt-5…) only accept the default temperature
        ...(/^gpt-4/.test(this.model) && { temperature: 0.3 }),
        max_completion_tokens: options.maxTokens ?? 700,
        response_format: { type: 'json_schema', json_schema: { name: schema.name, strict: true, schema: schema.schema } },
      });
      content = res.choices[0]?.message?.content;
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 429) throw new LlmError('QUOTA', 'Limite de requêtes OpenAI atteinte');
      throw new LlmError('LLM_INDISPONIBLE', status ? `OpenAI HTTP ${status}` : error instanceof Error ? error.message.slice(0, 200) : 'erreur réseau');
    }
    if (!content) throw new LlmError('LLM_REPONSE_INVALIDE', 'Réponse vide');
    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new LlmError('LLM_REPONSE_INVALIDE', 'JSON invalide');
    }
  }
}
