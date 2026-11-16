import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssistantService } from './assistant.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { Role } from '../../generated/prisma/client.js';
import { QualifyProspectDto } from './dto/qualify-prospect.dto.js';

@ApiTags('Assistant IA Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assistant/admin')
export class AssistantAdminController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get('prospects')
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({
    summary: 'Liste des prospects chatbot',
    description:
      'Retourne la liste des prospects enregistres automatiquement via l assistant IA.',
  })
  getProspects(@CurrentUser() user: CurrentUserPayload) {
    return this.assistantService.getProspects(user.companyId);
  }

  @Get('projets-futurs')
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({
    summary: 'Liste des projets futurs detectes',
    description:
      'Retourne les besoins non classes, avec categorie proche suggeree et frequence de demande.',
  })
  getFutureProjects(@CurrentUser() user: CurrentUserPayload) {
    return this.assistantService.getFutureProjects(user.companyId);
  }

  @Post('prospects/:prospectId/qualify')
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({
    summary: 'Qualifier un prospect chatbot',
    description:
      'Convertit un prospect chatbot en demande de devis operationnelle, et peut creer un devis brouillon.',
  })
  qualifyProspect(
    @Param('prospectId', ParseIntPipe) prospectId: number,
    @Body() dto: QualifyProspectDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.assistantService.qualifyProspect({
      prospectId,
      companyId: user.companyId,
      actorUserId: user.userId,
      description: dto.description,
      createDevisDraft: dto.createDevisDraft,
    });
  }
  @Post('prospects/:prospectId/reject')
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({
    summary: 'Rejeter un prospect chatbot',
    description: 'Marque les demandes ouvertes du prospect comme PERDU (trace conservee).',
  })
  rejectProspect(
    @Param('prospectId', ParseIntPipe) prospectId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.assistantService.rejectProspect({
      prospectId,
      companyId: user.companyId,
    });
  }
  @Patch('prospects/:prospectId/notes')
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({
    summary: 'Modifier les notes internes d un prospect chatbot',
  })
  updateProspectNotes(
    @Param('prospectId', ParseIntPipe) prospectId: number,
    @Body() body: { notes: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.assistantService.updateProspectNotes({
      prospectId,
      companyId: user.companyId,
      notes: typeof body.notes === 'string' ? body.notes : '',
    });
  }
  @Post('prospects/check-duplicates')
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({
    summary: 'Detecter les prospects en doublon potentiel (email/telephone)',
  })
  checkDuplicates(
    @Body()
    body: { email?: string; telephone?: string; excludeProspectId?: number },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.assistantService.findPotentialDuplicates({
      companyId: user.companyId,
      email: body.email,
      telephone: body.telephone,
      excludeProspectId: body.excludeProspectId,
    });
  }
  @Delete('prospects/:prospectId')
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({
    summary: 'Supprimer un prospect chatbot',
    description:
      'Supprime un prospect issu du chatbot ainsi que ses donnees reliees (demandes/devis).',
  })
  removeProspect(
    @Param('prospectId', ParseIntPipe) prospectId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.assistantService.removeProspect({
      prospectId,
      currentUser: user,
    });
  }
}
