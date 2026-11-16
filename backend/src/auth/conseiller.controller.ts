import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { SaveSignatureDto } from './dto/save-signature.dto.js';
import { AuthService } from './auth.service.js';

@ApiTags('Conseiller')
@Controller('conseiller')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(Role.TECHNICO, Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER)
export class ConseillerController {
  constructor(private readonly authService: AuthService) {}

  @Get('signature')
  @ApiOperation({ summary: 'Recuperer la signature du conseiller connecte' })
  getSignature(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getSignature(user);
  }

  @Post('signature')
  @ApiOperation({
    summary: 'Sauvegarder ou remplacer la signature du conseiller connecte',
  })
  saveSignature(
    @Body() dto: SaveSignatureDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.authService.saveSignature(dto, user);
  }
}
