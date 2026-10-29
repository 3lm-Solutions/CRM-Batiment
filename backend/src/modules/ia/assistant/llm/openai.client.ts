import OpenAI from 'openai';
import {
  LlmError,
  type LlmClient,
  type LlmJsonSchema,
  type LlmMessage,
  type LlmOptions,
} from './llm.client';

/** Models that « think » before answering: their reasoning counts in the token budget. */
const REASONING_MODEL = /gpt-oss|^o\d|gpt-5/;
/** Room left for the reasoning, on top of the answer itself */
const REASONING_FACTOR = 3;

/**
 * OpenAI chat completions with a JSON schema (spec: "NestJS + OpenAI SDK"). Works with any
 * OpenAI-compatible API (Groq, xAI Grok…).
 */
export class OpenAiLlmClient implements LlmClient {
  readonly name = 'openai';
  private readonly client: OpenAI;
  private readonly reasoning: boolean;

  constructor(
    apiKey: string,
    private readonly model: string,
    timeoutMs: number,
    baseURL?: string,
    /**
     * OpenAI's strict structured outputs. Other providers (Groq…) support a JSON schema on fewer
     * models in strict mode, so the vision client may turn it off: the answer is validated anyway.
     */
    private readonly strict = true,
  ) {
    // One retry on network errors / 5xx; the visitor should not wait more than ~2 × timeout.
    // baseURL: any OpenAI-compatible API (xAI Grok…); undefined = OpenAI.
    this.client = new OpenAI({ apiKey, baseURL, timeout: timeoutMs, maxRetries: 1 });
    this.reasoning = REASONING_MODEL.test(model);
  }

  async completeJson(
    messages: LlmMessage[],
    schema: LlmJsonSchema,
    options: LlmOptions = {},
  ): Promise<unknown> {
    try {
      return await this.call(messages, schema, options, 'schema');
    } catch (error) {
      // Groq (and some others) reject an answer that does not match the schema exactly
      // (« Failed to validate JSON »): one more try in plain JSON mode, the schema in the prompt.
      // The caller validates the answer anyway (unknown ids, quantities… are dropped).
      if (isSchemaRejection(error)) return this.call(messages, schema, options, 'json');
      throw error;
    }
  }

  private async call(
    messages: LlmMessage[],
    schema: LlmJsonSchema,
    options: LlmOptions,
    mode: 'schema' | 'json',
  ): Promise<unknown> {
    const answerTokens = options.maxTokens ?? 700;
    const sent = mode === 'json' ? withSchemaInPrompt(messages, schema) : messages;
    let content: string | null | undefined;
    try {
      const res = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: sent.map(toOpenAi),
          // Reasoning models (o-series, gpt-5, gpt-oss…) only accept the default temperature
          ...(/^gpt-4/.test(this.model) ? { temperature: 0.3 } : {}),
          // A short reasoning: faster, and it cannot eat the whole budget and cut the JSON
          ...(this.reasoning ? { reasoning_effort: 'low' as const } : {}),
          max_completion_tokens: this.reasoning ? answerTokens * REASONING_FACTOR : answerTokens,
          response_format:
            mode === 'schema'
              ? {
                  type: 'json_schema',
                  json_schema: { name: schema.name, strict: this.strict, schema: schema.schema },
                }
              : { type: 'json_object' },
        },
        options.timeoutMs ? { timeout: options.timeoutMs } : undefined,
      );
      content = res.choices[0]?.message?.content;
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 429) throw new LlmError('QUOTA', 'Limite de requêtes OpenAI atteinte');
      // The API's own explanation (wrong model, image refused…) is kept: « HTTP 400 » alone says nothing
      const detail = error instanceof Error ? error.message.replace(/\s+/g, ' ').slice(0, 300) : '';
      throw new LlmError(
        'LLM_INDISPONIBLE',
        status
          ? `OpenAI HTTP ${status} (${this.model})${detail ? ` : ${detail}` : ''}`
          : detail || 'erreur réseau',
      );
    }
    if (!content) throw new LlmError('LLM_REPONSE_INVALIDE', 'Réponse vide');
    try {
      return JSON.parse(stripFences(content)) as unknown;
    } catch {
      throw new LlmError('LLM_REPONSE_INVALIDE', 'JSON invalide');
    }
  }
}

function isSchemaRejection(error: unknown): boolean {
  // Also a model that does not support JSON schemas at all (some Groq vision models: JSON mode only)
  return (
    error instanceof LlmError &&
    /HTTP 400/.test(error.message) &&
    /validate JSON|json_validate_failed|failed_generation|response_format|json_schema/i.test(
      error.message,
    )
  );
}

/** Plain JSON mode: the expected shape is written into the system message. */
function withSchemaInPrompt(messages: LlmMessage[], schema: LlmJsonSchema): LlmMessage[] {
  const rule = `\n\nRÉPONSE : un seul objet JSON valide, sans texte autour, exactement selon ce schéma JSON :\n${JSON.stringify(schema.schema)}`;
  const i = messages.findIndex((m) => m.role === 'system');
  if (i === -1) return [{ role: 'system', content: rule.trim() }, ...messages];
  return messages.map((m, j) => (j === i ? { ...m, content: m.content + rule } : m));
}

/** Some models wrap the JSON in ```json … ``` even in JSON mode. */
function stripFences(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t);
  return m ? m[1] : t;
}

/** A user message with photos becomes text + image parts; everything else is sent as is. */
function toOpenAi(m: LlmMessage): OpenAI.Chat.ChatCompletionMessageParam {
  if (m.role === 'user' && m.images?.length) {
    return {
      role: 'user',
      content: [
        { type: 'text', text: m.content },
        ...m.images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
      ],
    };
  }
  return { role: m.role, content: m.content };
}
