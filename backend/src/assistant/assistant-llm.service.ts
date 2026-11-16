import { Injectable, Logger } from '@nestjs/common';

type AssistantLlmInput = {
  language: 'fr' | 'ar';
  userMessage: string;
  fallbackMessage: string;
  intent:
    | 'demande_devis'
    | 'demande_info_service'
    | 'demande_prix'
    | 'information_generale'
    | 'autre';
  projectType: string;
  knownProject: boolean;
  suggestedType: string | null;
  missingFields: string[];
  collectedData: {
    nom: string;
    telephone: string;
    email: string;
    description: string;
  };
  availableProjectTypes: string[];
};

export type ExtractedFields = {
  nom: string;
  telephone: string;
  email: string;
  description: string;
  projectType: string;
  intent:
    | 'demande_devis'
    | 'demande_info_service'
    | 'demande_prix'
    | 'information_generale'
    | 'autre';
  isUrgent: boolean;
  motsCles: string[];
};

type LlmProvider = 'none' | 'huggingface' | 'mistral' | 'both';

@Injectable()
export class AssistantLlmService {
  private readonly logger = new Logger(AssistantLlmService.name);
  private readonly defaultWordLimit = 70;
  private readonly defaultMaxChars = 360;

  async extractFieldsWithAI(
    userMessage: string,
    availableProjectTypes: string[],
  ): Promise<ExtractedFields | null> {
    const provider = this.getProvider();
    if (provider === 'none') return null;

    const providers = this.getProviderOrder(provider);

    for (const currentProvider of providers) {
      try {
        const result =
          currentProvider === 'mistral'
            ? await this.extractFieldsWithMistral(
                userMessage,
                availableProjectTypes,
              )
            : await this.extractFieldsWithHuggingFace(
                userMessage,
                availableProjectTypes,
              );

        if (result) return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown';
        this.logger.warn(
          `Field extraction failed with ${currentProvider}: ${message}`,
        );
      }
    }

    return null;
  }

  private async extractFieldsWithMistral(
    userMessage: string,
    availableProjectTypes: string[],
  ): Promise<ExtractedFields | null> {
    const apiKey = process.env.MISTRAL_API_KEY?.trim();
    if (!apiKey) return null;

    const model = process.env.MISTRAL_MODEL?.trim() || 'mistral-small-latest';
    const timeoutMs = this.getTimeoutMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.0,
          max_tokens: 180,
          messages: [
            {
              role: 'system',
              content: `Tu es un extracteur CRM batiment. Reponds uniquement avec un JSON valide:\n{"nom":"","telephone":"","email":"","description":"","project_type":"","intent":"autre","is_urgent":false,"mots_cles":[]}\n\nRegles:\n- intent parmi demande_devis | demande_info_service | demande_prix | information_generale | autre\n- nom sans chiffres\n- telephone en chiffres\n- project_type priorite a cette liste: ${availableProjectTypes.join(' | ')}\n- si absent, laisser champ vide\n- mots_cles: 3 a 6 termes`,
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const data = (await response.json()) as Record<string, unknown>;
      const choices = Array.isArray(data.choices)
        ? (data.choices as Array<Record<string, unknown>>)
        : [];
      const content = (choices[0]?.message as Record<string, unknown>)?.content;

      if (typeof content !== 'string') return null;
      return this.parseExtractedJson(content);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async extractFieldsWithHuggingFace(
    userMessage: string,
    availableProjectTypes: string[],
  ): Promise<ExtractedFields | null> {
    const token = process.env.HUGGINGFACE_API_KEY?.trim();
    if (!token) return null;

    const model =
      process.env.HUGGINGFACE_MODEL?.trim() ||
      'mistralai/Mistral-7B-Instruct-v0.3';
    const timeoutMs = this.getTimeoutMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        'https://router.huggingface.co/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            temperature: 0.0,
            max_tokens: 180,
            messages: [
              {
                role: 'system',
                content: `Extracteur CRM. Reponds uniquement en JSON:\n{"nom":"","telephone":"","email":"","description":"","project_type":"","intent":"autre","is_urgent":false,"mots_cles":[]}\nType projet: ${availableProjectTypes.join(' | ')}`,
              },
              { role: 'user', content: userMessage },
            ],
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) return null;

      const data = (await response.json()) as Record<string, unknown>;
      const choices = Array.isArray(data.choices)
        ? (data.choices as Array<Record<string, unknown>>)
        : [];
      const content = (choices[0]?.message as Record<string, unknown>)?.content;

      if (typeof content !== 'string') return null;
      return this.parseExtractedJson(content);
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseExtractedJson(raw: string): ExtractedFields | null {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      const rawIntent =
        typeof parsed.intent === 'string' ? parsed.intent.trim() : '';
      const intent:
        | 'demande_devis'
        | 'demande_info_service'
        | 'demande_prix'
        | 'information_generale'
        | 'autre' =
        rawIntent === 'demande_devis' ||
        rawIntent === 'demande_info_service' ||
        rawIntent === 'demande_prix' ||
        rawIntent === 'information_generale'
          ? rawIntent
          : 'autre';

      const keywordsRaw = Array.isArray(parsed.mots_cles)
        ? parsed.mots_cles
        : Array.isArray(parsed.motsCles)
          ? parsed.motsCles
          : [];

      const motsCles = keywordsRaw
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length > 1)
        .slice(0, 6);

      return {
        nom: typeof parsed.nom === 'string' ? parsed.nom.trim() : '',
        telephone:
          typeof parsed.telephone === 'string' ? parsed.telephone.trim() : '',
        email:
          typeof parsed.email === 'string'
            ? parsed.email.trim().toLowerCase()
            : '',
        description:
          typeof parsed.description === 'string'
            ? parsed.description.trim()
            : '',
        projectType:
          typeof parsed.project_type === 'string'
            ? parsed.project_type.trim()
            : typeof parsed.projectType === 'string'
              ? parsed.projectType.trim()
              : '',
        intent,
        isUrgent: Boolean(parsed.is_urgent),
        motsCles,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`Failed to parse extracted fields JSON: ${message}`);
      return null;
    }
  }

  async generateReply(input: AssistantLlmInput): Promise<string | null> {
    const provider = this.getProvider();
    if (provider === 'none') return null;

    const providers = this.getProviderOrder(provider);

    for (const currentProvider of providers) {
      try {
        const reply =
          currentProvider === 'huggingface'
            ? await this.generateWithHuggingFace(input)
            : await this.generateWithMistral(input);

        if (reply) return reply;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown-llm-error';
        this.logger.warn(
          `LLM provider ${currentProvider} failed, trying fallback: ${message}`,
        );
      }
    }

    return null;
  }

  private getProvider(): LlmProvider {
    const raw = (process.env.ASSISTANT_LLM_PROVIDER || 'none')
      .trim()
      .toLowerCase();

    if (raw === 'hf' || raw === 'huggingface') return 'huggingface';
    if (raw === 'mistral') return 'mistral';
    if (
      raw === 'both' ||
      raw === 'all' ||
      raw === 'mistral+huggingface' ||
      raw === 'huggingface+mistral'
    ) {
      return 'both';
    }

    return 'none';
  }

  private getProviderOrder(
    provider: Exclude<LlmProvider, 'none'>,
  ): Array<'huggingface' | 'mistral'> {
    if (provider === 'huggingface' || provider === 'mistral') {
      return [provider];
    }

    const primary = (process.env.ASSISTANT_LLM_PRIMARY || 'mistral')
      .trim()
      .toLowerCase();

    if (primary === 'mistral') return ['mistral', 'huggingface'];
    return ['huggingface', 'mistral'];
  }

  private async generateWithHuggingFace(
    input: AssistantLlmInput,
  ): Promise<string | null> {
    const token = process.env.HUGGINGFACE_API_KEY?.trim();
    if (!token) return null;

    const model =
      process.env.HUGGINGFACE_MODEL?.trim() ||
      'mistralai/Mistral-7B-Instruct-v0.3';
    const timeoutMs = this.getTimeoutMs();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        'https://router.huggingface.co/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            temperature: 0.15,
            max_tokens: 220,
            messages: [
              {
                role: 'system',
                content:
                  'You are a CRM construction assistant. Keep the exact same business decision as fallback, answer in plain spoken language, and keep sentences short and human.',
              },
              { role: 'user', content: this.buildPrompt(input) },
            ],
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) return null;

      const data = (await response.json()) as Record<string, unknown>;
      const choices = Array.isArray(data.choices)
        ? (data.choices as Array<Record<string, unknown>>)
        : [];
      const content = (choices[0]?.message as Record<string, unknown>)?.content;

      return typeof content === 'string'
        ? this.cleanGeneratedText(content)
        : null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async generateWithMistral(
    input: AssistantLlmInput,
  ): Promise<string | null> {
    const apiKey = process.env.MISTRAL_API_KEY?.trim();
    if (!apiKey) return null;

    const model = process.env.MISTRAL_MODEL?.trim() || 'mistral-small-latest';
    const timeoutMs = this.getTimeoutMs();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.15,
          max_tokens: 220,
          messages: [
            {
              role: 'system',
              content:
                'You are a CRM construction assistant. Keep the exact same business decision as fallback, answer in plain spoken language, and keep sentences short and human.',
            },
            { role: 'user', content: this.buildPrompt(input) },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const data = (await response.json()) as Record<string, unknown>;
      const choices = Array.isArray(data.choices)
        ? (data.choices as Array<Record<string, unknown>>)
        : [];
      const content = (choices[0]?.message as Record<string, unknown>)?.content;

      return typeof content === 'string'
        ? this.cleanGeneratedText(content)
        : null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildPrompt(input: AssistantLlmInput): string {
    const wordLimit = this.getWordLimit();
    const languageInstruction =
      input.language === 'ar'
        ? 'Answer in Arabic only. Use simple and respectful everyday Arabic.'
        : 'Answer in French only. Use simple and respectful everyday French.';

    const context = {
      intent: input.intent,
      project_type: input.projectType,
      is_known_project: input.knownProject,
      suggested_type: input.suggestedType,
      missing_fields: input.missingFields,
      collected_data: input.collectedData,
      available_project_types: input.availableProjectTypes,
      fallback_response: input.fallbackMessage,
      user_message: input.userMessage,
    };

    return [
      'Rewrite the fallback CRM response in a natural and human tone.',
      'Keep exactly the same business intent and next required action.',
      'Do not invent unavailable services or missing data.',
      'Use short and clear sentences.',
      'Use at most one question in the reply.',
      'Avoid technical jargon and avoid long paragraphs.',
      languageInstruction,
      `Limit to at most ${wordLimit} words.`,
      `Context JSON: ${JSON.stringify(context)}`,
      'Final answer only:',
    ].join('\n');
  }

  private cleanGeneratedText(text: string): string | null {
    const cleaned = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/^\s*(assistant|reponse|réponse)\s*[:：-]?\s*/i, '')
      .replace(/^\s*(final answer|answer)\s*[:：-]?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return null;

    return cleaned.slice(0, this.getMaxChars());
  }

  private getWordLimit(): number {
    const raw = Number.parseInt(process.env.ASSISTANT_LLM_WORD_LIMIT || '', 10);
    if (Number.isNaN(raw) || raw < 25 || raw > 200)
      return this.defaultWordLimit;
    return raw;
  }

  private getMaxChars(): number {
    const raw = Number.parseInt(process.env.ASSISTANT_LLM_MAX_CHARS || '', 10);
    if (Number.isNaN(raw) || raw < 120 || raw > 1200)
      return this.defaultMaxChars;
    return raw;
  }

  private getTimeoutMs(): number {
    const raw = Number.parseInt(process.env.ASSISTANT_LLM_TIMEOUT_MS || '', 10);
    if (Number.isNaN(raw) || raw < 1000 || raw > 60000) return 12000;
    return raw;
  }
}
