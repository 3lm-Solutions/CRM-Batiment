import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, BUREAU, CurrentUser, Roles } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import {
  CreateFournisseurDto,
  LierCompteFournisseurDto,
  MateriauxFournisseurDto,
  QueryFournisseursDto,
  UpdateFournisseurDto,
} from './dto/fournisseurs.dto';
import { FournisseursService } from './fournisseurs.service';

@ApiTags('Fournisseurs')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('fournisseurs')
export class FournisseursController {
  constructor(private readonly fournisseurs: FournisseursService) {}

  @Roles(...BUREAU)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryFournisseursDto) {
    return this.fournisseurs.findAll(user, query);
  }

  @Roles(...BUREAU)
  @Get(':id')
  @ApiOperation({ summary: 'Fiche fournisseur + matériaux fournis' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.fournisseurs.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFournisseurDto) {
    return this.fournisseurs.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier (actif: false pour désactiver)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFournisseurDto,
  ) {
    return this.fournisseurs.update(user, id, dto);
  }

  @Put(':id/materiaux')
  @ApiOperation({
    summary: 'Matériaux fournis : la liste remplace l’actuelle (un matériau = un fournisseur)',
  })
  remplacerMateriaux(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MateriauxFournisseurDto,
  ) {
    return this.fournisseurs.remplacerMateriaux(user, id, dto.materiauIds);
  }

  @Put(':id/compte')
  @ApiOperation({ summary: 'Lier le compte du portail fournisseur (null = délier)' })
  lierCompte(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LierCompteFournisseurDto,
  ) {
    return this.fournisseurs.lierCompte(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suppression définitive (409 si le fournisseur a des commandes)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.fournisseurs.remove(user, id);
  }
}
