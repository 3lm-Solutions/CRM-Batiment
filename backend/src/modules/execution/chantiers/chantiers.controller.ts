import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, BUREAU, CurrentUser, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { ChantiersService } from './chantiers.service';
import { AccesSousTraitantsDto, CreateChantierDto, CreateDocumentDto, Plan2dDto, QueryChantiersDto, UpdateChantierDto } from './dto/chantiers.dto';

const OPERATIONS = [Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER];

@ApiTags('Chantiers')
@ApiBearerAuth()
@Roles(...OPERATIONS)
@Controller('chantiers')
export class ChantiersController {
  constructor(private readonly chantiers: ChantiersService) {}

  // Staff only. A sous-traitant uses /portail/sous-traitant/chantiers, which never returns the client's
  // phone, internal notes or other people's comments (this route used to accept him too: data leak).
  @Roles(...STAFF)
  @Get()
  @ApiOperation({ summary: 'Liste (chef de chantier : ses chantiers uniquement)' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryChantiersDto) {
    return this.chantiers.findAll(user, query);
  }

  @Roles(...STAFF)
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.chantiers.findOne(user, id);
  }

  @Roles(...BUREAU)
  @Post()
  @ApiOperation({ summary: 'Chantier hors devis (les chantiers issus d’un devis sont créés à la signature)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateChantierDto) {
    return this.chantiers.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateChantierDto) {
    return this.chantiers.update(user, id, dto);
  }

  @Post(':id/demarrer') @HttpCode(HttpStatus.OK)
  demarrer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.chantiers.transition(user, id, 'EN_COURS');
  }

  @Post(':id/suspendre') @HttpCode(HttpStatus.OK)
  suspendre(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.chantiers.transition(user, id, 'SUSPENDU');
  }

  @Post(':id/reprendre') @HttpCode(HttpStatus.OK)
  reprendre(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.chantiers.transition(user, id, 'EN_COURS');
  }

  @Post(':id/terminer') @HttpCode(HttpStatus.OK)
  terminer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.chantiers.transition(user, id, 'TERMINE');
  }

  @Roles(...BUREAU)
  @Post(':id/cloturer') @HttpCode(HttpStatus.OK)
  cloturer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.chantiers.transition(user, id, 'CLOTURE');
  }

  @Roles(Role.ADMIN, Role.ASSISTANTE)
  @Post(':id/annuler') @HttpCode(HttpStatus.OK)
  annuler(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.chantiers.transition(user, id, 'ANNULE');
  }

  @Put(':id/acces-sous-traitants')
  @ApiOperation({ summary: 'Comptes sous-traitants qui voient ce chantier dans leur portail' })
  acces(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AccesSousTraitantsDto) {
    return this.chantiers.setAccesSousTraitants(user, id, dto);
  }

  @Put(':id/plan-2d')
  savePlan(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: Plan2dDto) {
    return this.chantiers.savePlan2d(user, id, dto.plan);
  }

  @Delete(':id/plan-2d') @HttpCode(HttpStatus.NO_CONTENT)
  removePlan(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.chantiers.removePlan2d(user, id);
  }

  @Post(':id/documents')
  addDocument(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateDocumentDto) {
    return this.chantiers.addDocument(user, id, dto);
  }

  @Delete(':id/documents/:documentId') @HttpCode(HttpStatus.NO_CONTENT)
  removeDocument(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    return this.chantiers.removeDocument(user, id, documentId);
  }

  @Roles(Role.ADMIN)
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.chantiers.remove(user, id);
  }
}
