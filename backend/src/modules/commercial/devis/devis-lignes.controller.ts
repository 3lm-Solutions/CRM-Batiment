import { Body, Controller, Delete, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, BUREAU, CurrentUser, Roles } from '../../../common';
import { DevisLignesService } from './devis-lignes.service';
import { ReordonnerLignesDto } from './dto/devis.dto';
import { AddLigneDto, UpdateLigneDto } from './dto/lignes.dto';

/** Each call returns the whole updated quote (lines + recalculated totals). */
@ApiTags('Devis — lignes')
@ApiBearerAuth()
@Roles(...BUREAU)
@Controller('devis/:devisId/lignes')
export class DevisLignesController {
  constructor(private readonly lignes: DevisLignesService) {}

  @Post()
  @ApiOperation({ summary: 'Ajouter une ligne (prestation du catalogue + choix, ou ligne libre)' })
  add(@CurrentUser() user: AuthUser, @Param('devisId', ParseIntPipe) devisId: number, @Body() dto: AddLigneDto) {
    return this.lignes.add(user, devisId, dto);
  }

  @Put('ordre')
  reorder(@CurrentUser() user: AuthUser, @Param('devisId', ParseIntPipe) devisId: number, @Body() dto: ReordonnerLignesDto) {
    return this.lignes.reorder(user, devisId, dto);
  }

  @Patch(':ligneId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('devisId', ParseIntPipe) devisId: number,
    @Param('ligneId', ParseIntPipe) ligneId: number,
    @Body() dto: UpdateLigneDto,
  ) {
    return this.lignes.update(user, devisId, ligneId, dto);
  }

  @Delete(':ligneId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('devisId', ParseIntPipe) devisId: number,
    @Param('ligneId', ParseIntPipe) ligneId: number,
  ) {
    return this.lignes.remove(user, devisId, ligneId);
  }
}
