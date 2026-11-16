import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { CreateMouvementStockDto } from './dto/create-mouvement-stock.dto.js';
import { UpdateStockSettingsDto } from './dto/update-stock-settings.dto.js';
import { StockService } from './stock.service.js';

@ApiTags('Stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER)
@Controller('stock')
export class StockController {
  constructor(private readonly service: StockService) {}

  @Get()
  @ApiOperation({ summary: 'Consulter le stock, les seuils et le résumé' })
  list(@Query('search') search: string | undefined, @CurrentUser() user: CurrentUserPayload) {
    return this.service.list(search, user);
  }

  @Get('mouvements')
  @ApiOperation({ summary: 'Consulter les derniers mouvements de stock' })
  listMovements(
    @Query('materiauId') materiauId: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.listMovements(
      materiauId ? Number(materiauId) : undefined,
      limit ? Number(limit) : 50,
      user,
    );
  }

  @Post('mouvements')
  @Roles(Role.ADMIN, Role.CHEF_CHANTIER)
  @ApiOperation({ summary: 'Enregistrer une entrée, sortie ou correction de stock' })
  createMovement(@Body() dto: CreateMouvementStockDto, @CurrentUser() user: CurrentUserPayload) {
    return this.service.createMovement(dto, user);
  }

  @Patch('materiaux/:id/seuil')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Modifier le seuil minimum d un matériau' })
  updateThreshold(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockSettingsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateThreshold(id, dto.stockMinimum, user);
  }
}
