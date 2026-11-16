import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AssistantService } from './assistant.service.js';
import { StartAssistantSessionDto } from './dto/start-assistant-session.dto.js';
import { PostAssistantMessageDto } from './dto/post-assistant-message.dto.js';
import { GetAssistantSessionDto } from './dto/get-assistant-session.dto.js';
import { SubmitStructuredAssistantDto } from './dto/submit-structured-assistant.dto.js';
import { AssistantFeedbackDto } from './dto/assistant-feedback.dto.js';
@ApiTags('Assistant IA Public')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('session/start')
  @ApiOperation({
    summary: 'Demarrer une session prospect',
    description: 'Cree une session de conversation pour un visiteur public.',
  })
  startSession(@Body() dto: StartAssistantSessionDto) {
    return this.assistantService.startSession(dto);
  }

  @Post('session/:sessionId/message')
  @ApiOperation({
    summary: 'Analyser un message prospect',
    description:
      'Analyse intention/projet/champs manquants et retourne le JSON metier du sprint 1.',
  })
  postMessage(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: PostAssistantMessageDto,
  ) {
    return this.assistantService.postMessage(sessionId, dto);
  }

  @Post('feedback')
  @ApiOperation({
    summary: 'Enregistrer un feedback utilisateur',
    description: 'Sauvegarde un avis (pouce haut/bas) sur une reponse du chatbot.',
  })
  saveFeedback(@Body() dto: AssistantFeedbackDto) {
    return this.assistantService.saveFeedback(dto);
  }

  @Post('session/:sessionId/structured')
  @ApiOperation({
    summary: 'Soumettre un formulaire assistant structure',
    description:
      'Flux non conversationnel: collecte infos client, filtre le besoin, propose categories/options et peut generer un PDF.',
  })
  submitStructured(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: SubmitStructuredAssistantDto,
  ) {
    return this.assistantService.submitStructuredRequest(sessionId, dto);
  }

  @Get('session/:sessionId')
  @ApiOperation({ summary: 'Lire une session et son historique recent' })
  getSession(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Query() query: GetAssistantSessionDto,
  ) {
    return this.assistantService.getSession(sessionId, query.companyId);
  }

  @Get('session/:sessionId/structured/pdf')
  @ApiOperation({
    summary: 'Telecharger le PDF structure genere par assistant',
  })
  async downloadStructuredPdf(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Query() query: GetAssistantSessionDto,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.assistantService.getStructuredPdf(
      sessionId,
      query.companyId,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }
}
