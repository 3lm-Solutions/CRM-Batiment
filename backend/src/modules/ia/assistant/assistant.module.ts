import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.validation';
import { ChatbotController, ConnaissancesController, ProspectsController } from './assistant.controller';
import { ChatbotService } from './chatbot.service';
import { ConnaissancesService } from './connaissances.service';
import { EmailProspectsService } from './email/email-prospects.service';
import { motsObjet } from './email/email-rules';
import { ImapMailboxReader, MAILBOX_READER } from './email/mailbox.reader';
import { LLM_CLIENT, LLM_VISION_CLIENT } from './llm/llm.client';
import { OpenAiLlmClient } from './llm/openai.client';
import { ProspectDedupService } from './prospect-dedup.service';
import { ProspectsService } from './prospects.service';

/**
 * Step 14 — AI assistant: public chatbot (prospect collection, answers from the knowledge base),
 * back-office qualification, knowledge base. Without OPENAI_API_KEY the chatbot runs in guided mode.
 */
@Module({
  controllers: [ChatbotController, ProspectsController, ConnaissancesController],
  providers: [
    ChatbotService,
    ProspectsService,
    ConnaissancesService,
    ProspectDedupService,
    EmailProspectsService,
    {
      // Prospects by email (22/10): null = no mailbox configured
      provide: MAILBOX_READER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const host = config.get('IMAP_HOST', { infer: true });
        const user = config.get('IMAP_USER', { infer: true });
        const pass = config.get('IMAP_PASS', { infer: true });
        if (!host || !user || !pass) return null;
        return new ImapMailboxReader({
          host,
          user,
          pass,
          port: config.get('IMAP_PORT', { infer: true }),
          secure: config.get('IMAP_SECURE', { infer: true }),
          folder: config.get('IMAP_FOLDER', { infer: true }),
          subjects: motsObjet(config.get('IMAP_SUBJECTS', { infer: true })),
        });
      },
    },
    {
      provide: LLM_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const key = config.get('OPENAI_API_KEY', { infer: true });
        const logger = new Logger('AssistantModule');
        if (!key) {
          logger.log('OPENAI_API_KEY absente : chatbot et devis IA en mode guidé (sans IA)');
          return null;
        }
        const model = config.get('OPENAI_MODEL', { infer: true });
        const baseUrl = config.get('OPENAI_BASE_URL', { infer: true });
        logger.log(`IA : ${baseUrl ?? 'OpenAI'}, modèle ${model}`);
        return new OpenAiLlmClient(key, model, config.get('OPENAI_TIMEOUT_MS', { infer: true }), baseUrl);
      },
    },
    {
      // Quote from a photo (C37 of 21/10): a model that reads images, same provider by default
      provide: LLM_VISION_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const logger = new Logger('AssistantModule');
        const model = config.get('OPENAI_VISION_MODEL', { infer: true });
        const key = config.get('OPENAI_VISION_API_KEY', { infer: true }) ?? config.get('OPENAI_API_KEY', { infer: true });
        if (!model || !key) {
          logger.log('OPENAI_VISION_MODEL absent : devis IA depuis photo indisponible (onglet Texte seulement)');
          return null;
        }
        // A dedicated key without a dedicated URL means OpenAI itself
        const ownKey = !!config.get('OPENAI_VISION_API_KEY', { infer: true });
        const baseUrl = config.get('OPENAI_VISION_BASE_URL', { infer: true }) ?? (ownKey ? undefined : config.get('OPENAI_BASE_URL', { infer: true }));
        const isOpenAi = !baseUrl || baseUrl.includes('api.openai.com');
        logger.log(`IA photos : ${baseUrl ?? 'OpenAI'}, modèle ${model}`);
        return new OpenAiLlmClient(key, model, config.get('OPENAI_TIMEOUT_MS', { infer: true }), baseUrl, isOpenAi);
      },
    },
  ],
  // The language models are shared with the quote assistant (Step 15)
  exports: [LLM_CLIENT, LLM_VISION_CLIENT],
})
export class AssistantModule {}
