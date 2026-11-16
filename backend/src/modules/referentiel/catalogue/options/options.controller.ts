import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles } from '../../../../common';
import { Role } from '../../../../generated/prisma/client';
import { ReplaceCompositionsDto } from '../compositions/compositions.dto';
import { CreateChoixDto, CreateOptionDto, UpdateChoixDto, UpdateOptionDto } from './options.dto';
import { OptionsService } from './options.service';

@ApiTags('Catalogue — options et choix')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('catalogue')
export class OptionsController {
  constructor(private readonly options: OptionsService) {}

  @Post('prestations/:id/options')
  createOption(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) prestationId: number,
    @Body() dto: CreateOptionDto,
  ) {
    return this.options.createOption(user, prestationId, dto);
  }

  @Patch('options/:id')
  updateOption(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOptionDto,
  ) {
    return this.options.updateOption(user, id, dto);
  }

  @Delete('options/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeOption(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.options.removeOption(user, id);
  }

  @Post('options/:id/choix')
  createChoix(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) optionId: number,
    @Body() dto: CreateChoixDto,
  ) {
    return this.options.createChoix(user, optionId, dto);
  }

  @Patch('choix/:id')
  updateChoix(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChoixDto,
  ) {
    return this.options.updateChoix(user, id, dto);
  }

  @Delete('choix/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeChoix(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.options.removeChoix(user, id);
  }

  @Put('choix/:id/compositions')
  @ApiOperation({
    summary: 'Composition propre à un choix',
    description:
      'Remplace la composition de base de la prestation quand ce choix est sélectionné. Liste vide = supprimer.',
  })
  replaceChoixCompositions(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplaceCompositionsDto,
  ) {
    return this.options.replaceChoixCompositions(user, id, dto);
  }
}
