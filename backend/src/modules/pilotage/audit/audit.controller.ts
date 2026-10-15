import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { QueryAuditDto } from './audit.dto';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Historique des modifications (prix, signatures, devis, factures)' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryAuditDto) {
    return this.audit.findAll(user, query);
  }

  @Get(':entite/:entiteId')
  @ApiOperation({ summary: 'Historique d’un élément, ex. /audit/Devis/42' })
  forEntity(@CurrentUser() user: AuthUser, @Param('entite') entite: string, @Param('entiteId', ParseIntPipe) entiteId: number) {
    return this.audit.findAll(user, Object.assign(new QueryAuditDto(), { entite, entiteId, page: 1, limit: 100 }));
  }
}
