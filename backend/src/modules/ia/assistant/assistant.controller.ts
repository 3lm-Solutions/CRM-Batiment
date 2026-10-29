import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type AuthUser, CurrentUser, Public, Roles } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { ChatbotService } from './chatbot.service';
import { ConnaissancesService } from './connaissances.service';
import {
  CreateConnaissanceDto,
  QueryConnaissancesDto,
  RechercheConnaissanceDto,
  UpdateConnaissanceDto,
} from './dto/connaissances.dto';
import {
  CoordonneesDto,
  FeedbackDto,
  PostMessageDto,
  QualifierProspectDto,
  QueryProspectsDto,
  RejeterProspectDto,
  StartSessionDto,
  UpdateProspectDto,
} from './dto/assistant.dto';
import { EmailProspectsService } from './email/email-prospects.service';
import { ProspectsService } from './prospects.service';

const TOKEN = 'x-chat-token';

/**
 * Public chatbot. No account: the conversation token (header X-Chat-Token, returned once at
 * start) is the credential. Rate-limited per IP; each message may cost an AI call.
 */
@ApiTags('Assistant IA — chatbot public')
@ApiHeader({
  name: TOKEN,
  required: false,
  description: 'Jeton de la conversation (sauf pour démarrer)',
})
@Public()
@Controller('public/assistant/sessions')
export class ChatbotController {
  constructor(private readonly chatbot: ChatbotService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  start(@Body() dto: StartSessionDto) {
    return this.chatbot.start(dto.companyId);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':id')
  history(@Param('id', ParseIntPipe) id: number, @Headers(TOKEN) token: string) {
    return this.chatbot.history(id, token);
  }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post(':id/messages')
  @HttpCode(HttpStatus.OK)
  message(
    @Param('id', ParseIntPipe) id: number,
    @Headers(TOKEN) token: string,
    @Body() dto: PostMessageDto,
  ) {
    return this.chatbot.message(id, token, dto.contenu);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':id/coordonnees')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Formulaire structuré « Demander un devis »' })
  coordonnees(
    @Param('id', ParseIntPipe) id: number,
    @Headers(TOKEN) token: string,
    @Body() dto: CoordonneesDto,
  ) {
    return this.chatbot.coordonnees(id, token, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/feedback')
  @HttpCode(HttpStatus.OK)
  feedback(
    @Param('id', ParseIntPipe) id: number,
    @Headers(TOKEN) token: string,
    @Body() dto: FeedbackDto,
  ) {
    return this.chatbot.feedback(id, token, dto);
  }
}

const COMMERCIAL = [Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE];

/** Back-office: chatbot prospects and their qualification (spec P1). */
@ApiTags('Assistant IA — prospects')
@Roles(...COMMERCIAL)
@Controller('assistant/prospects')
export class ProspectsController {
  constructor(
    private readonly prospects: ProspectsService,
    private readonly emails: EmailProspectsService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryProspectsDto) {
    return this.prospects.findAll(user, query);
  }

  @Get('statistiques')
  stats(@CurrentUser() user: AuthUser) {
    return this.prospects.stats(user);
  }

  @Get('emails/statut')
  @ApiOperation({ summary: 'Boîte mail des prospects : configurée ?, dernier relevé (22/10)' })
  emailStatut() {
    return this.emails.statut();
  }

  @Roles(Role.ADMIN)
  @Post('emails/relever')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lire maintenant les emails non lus de la boîte (sinon automatique)' })
  releverEmails() {
    return this.emails.relever();
  }

  @Roles(Role.ADMIN)
  @Get('erreurs')
  @ApiOperation({ summary: 'Journal des erreurs IA et des réponses bloquées' })
  erreurs(@CurrentUser() user: AuthUser, @Query('page') page?: string) {
    return this.prospects.erreurs(user, Math.max(1, Number(page) || 1));
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.prospects.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProspectDto,
  ) {
    return this.prospects.update(user, id, dto);
  }

  @Post(':id/qualifier')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transformer en demande de devis (client retrouvé ou créé)' })
  qualifier(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: QualifierProspectDto,
  ) {
    return this.prospects.qualifier(user, id, dto);
  }

  @Post(':id/rejeter')
  @HttpCode(HttpStatus.OK)
  rejeter(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejeterProspectDto,
  ) {
    return this.prospects.rejeter(user, id, dto.motif);
  }

  @Post(':id/rouvrir')
  @HttpCode(HttpStatus.OK)
  rouvrir(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.prospects.rouvrir(user, id);
  }
}

/** Knowledge base of the assistant: ADMIN writes, TECHNICO and ASSISTANTE read (RBAC matrix). */
@ApiTags('Assistant IA — base de connaissances')
@Roles(Role.ADMIN)
@Controller('assistant/connaissances')
export class ConnaissancesController {
  constructor(private readonly connaissances: ConnaissancesService) {}

  @Roles(...COMMERCIAL)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryConnaissancesDto) {
    return this.connaissances.findAll(user, query);
  }

  @Roles(...COMMERCIAL)
  @Get('categories')
  categories(@CurrentUser() user: AuthUser) {
    return this.connaissances.categories(user);
  }

  @Roles(...COMMERCIAL)
  @Get('recherche')
  @ApiOperation({ summary: 'Tester : quels documents l’assistant utiliserait pour cette question' })
  search(@CurrentUser() user: AuthUser, @Query() dto: RechercheConnaissanceDto) {
    return this.connaissances.search(user.companyId, dto.q, 5);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateConnaissanceDto) {
    return this.connaissances.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConnaissanceDto,
  ) {
    return this.connaissances.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.connaissances.remove(user, id);
  }
}
