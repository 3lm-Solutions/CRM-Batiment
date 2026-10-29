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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../../common';
import { Role } from '../../../../generated/prisma/client';
import {
  CreateCategorieDto,
  CreateSousCategorieDto,
  QueryCategoriesDto,
  UpdateCategorieDto,
  UpdateSousCategorieDto,
} from './categories.dto';
import { CategoriesService } from './categories.service';

@ApiTags('Catalogue — catégories')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('catalogue')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Roles(...STAFF)
  @Get('categories')
  @ApiOperation({ summary: 'Catégories avec leurs sous-catégories et nombres de prestations' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryCategoriesDto) {
    return this.categories.findAll(user, query);
  }

  @Post('categories')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategorieDto) {
    return this.categories.create(user, dto);
  }

  @Patch('categories/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategorieDto,
  ) {
    return this.categories.update(user, id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suppression (409 si des prestations l’utilisent — désactiver plutôt)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.categories.remove(user, id);
  }

  @Post('categories/:id/sous-categories')
  createSousCategorie(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) categorieId: number,
    @Body() dto: CreateSousCategorieDto,
  ) {
    return this.categories.createSousCategorie(user, categorieId, dto);
  }

  @Patch('sous-categories/:id')
  updateSousCategorie(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSousCategorieDto,
  ) {
    return this.categories.updateSousCategorie(user, id, dto);
  }

  @Delete('sous-categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSousCategorie(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.categories.removeSousCategorie(user, id);
  }
}
