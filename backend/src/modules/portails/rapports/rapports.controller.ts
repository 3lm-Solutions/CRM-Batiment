import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { ReviewRapportDto } from './rapports.dto';
import { RapportsService } from './rapports.service';

/** Same people who run the job site's tasks (ADMIN, ASSISTANTE, CHEF_CHANTIER). */
const REVIEWERS = [Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER];

/** Office / chef side of the sous-traitant site reports. */
@ApiTags('Rapports de chantier')
@Controller()
export class RapportsController {
  constructor(private readonly rapports: RapportsService) {}

  @Roles(...STAFF)
  @Get('chantiers/:chantierId/rapports')
  forChantier(@CurrentUser() user: AuthUser, @Param('chantierId', ParseIntPipe) chantierId: number) {
    return this.rapports.forChantier(user, chantierId);
  }

  @Roles(...REVIEWERS)
  @Post('rapports/:id/valider') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Valider (applique l’avancement déclaré à la tâche)' })
  valider(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReviewRapportDto) {
    return this.rapports.review(user, id, 'VALIDE', dto.commentaire);
  }

  @Roles(...REVIEWERS)
  @Post('rapports/:id/rejeter') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renvoyer au sous-traitant avec un commentaire' })
  rejeter(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReviewRapportDto) {
    return this.rapports.review(user, id, 'REJETE', dto.commentaire);
  }
}
