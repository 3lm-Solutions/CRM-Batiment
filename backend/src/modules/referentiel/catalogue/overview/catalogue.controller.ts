import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, costsFor, CurrentUser, Roles, STAFF } from '../../../../common';
import { Role } from '../../../../generated/prisma/client';
import { CatalogueOverviewService } from './catalogue-overview.service';

@ApiTags('Catalogue')
@ApiBearerAuth()
@Controller('catalogue')
export class CatalogueController {
  constructor(private readonly overview: CatalogueOverviewService) {}

  @Roles(...STAFF)
  @Get('tree')
  @ApiOperation({ summary: 'Catalogue actif en arbre (catégories → sous-catégories → prestations → options → choix)' })
  tree(@CurrentUser() user: AuthUser) {
    return costsFor(user, this.overview.tree(user));
  }

  @Roles(Role.ADMIN)
  @Get('validation')
  @ApiOperation({ summary: 'Contrôle de cohérence du catalogue (erreurs et avertissements)' })
  validation(@CurrentUser() user: AuthUser) {
    return this.overview.validation(user);
  }
}
