import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.validation';
import { ChatbotController, ConnaissancesController, ProspectsController } from './assistant.controller';
import { ChatbotService } from './chatbot.service';
import { ConnaissancesService } from './connaissances.service';
import { LLM_CLIENT } from './llm/llm.client';
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
  ],
  // The language model is shared with the quote assistant (Step 15)
  exports: [LLM_CLIENT],
})
export class AssistantModule {}
