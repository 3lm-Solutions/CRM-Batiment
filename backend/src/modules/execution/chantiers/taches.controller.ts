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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { CreateTacheDto, UpdateTacheDto } from './dto/chantiers.dto';
import { TachesService } from './taches.service';

@ApiTags('Chantiers — tâches')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER)
@Controller('chantiers/:chantierId/taches')
export class TachesController {
  constructor(private readonly taches: TachesService) {}

  @Roles(...STAFF)
  @Get()
  list(@CurrentUser() user: AuthUser, @Param('chantierId', ParseIntPipe) chantierId: number) {
    return this.taches.list(user, chantierId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('chantierId', ParseIntPipe) chantierId: number,
    @Body() dto: CreateTacheDto,
  ) {
    return this.taches.create(user, chantierId, dto);
  }

  @Patch(':tacheId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('chantierId', ParseIntPipe) chantierId: number,
    @Param('tacheId', ParseIntPipe) tacheId: number,
    @Body() dto: UpdateTacheDto,
  ) {
    return this.taches.update(user, chantierId, tacheId, dto);
  }

  @Delete(':tacheId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('chantierId', ParseIntPipe) chantierId: number,
    @Param('tacheId', ParseIntPipe) tacheId: number,
  ) {
    return this.taches.remove(user, chantierId, tacheId);
  }
}
