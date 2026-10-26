import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import { QueryPlanningDto } from './planning.dto';
import { PlanningService } from './planning.service';

@ApiTags('Planning')
@ApiBearerAuth()
@Roles(...STAFF)
@Controller('planning')
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Get()
  @ApiOperation({ summary: 'Tâches datées et indisponibilités des sous-traitants sur une période (45 jours max.)' })
  periode(@CurrentUser() user: AuthUser, @Query() query: QueryPlanningDto) {
    return this.planning.periode(user, query);
  }
}
