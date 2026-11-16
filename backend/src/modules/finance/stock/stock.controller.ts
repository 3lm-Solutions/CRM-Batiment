import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, costsFor, CurrentUser, Roles, STAFF } from '../../../common';
import { CreateMouvementDto, QueryMouvementsDto, QueryStockDto } from './stock.dto';
import { StockService } from './stock.service';

@ApiTags('Stock')
@ApiBearerAuth()
@Roles(...STAFF)
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  @ApiOperation({ summary: 'Niveaux de stock (?alerte=true : sous le seuil)' })
  list(@CurrentUser() user: AuthUser, @Query() query: QueryStockDto) {
    return costsFor(user, this.stock.list(user, query));
  }

  @Get('mouvements')
  movements(@CurrentUser() user: AuthUser, @Query() query: QueryMouvementsDto) {
    return this.stock.listMovements(user, query);
  }

  @Post('mouvements')
  @ApiOperation({
    summary: 'Entrée, sortie (refusée si stock insuffisant) ou ajustement d’inventaire',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMouvementDto) {
    return this.stock.createMovement(user, dto);
  }
}
