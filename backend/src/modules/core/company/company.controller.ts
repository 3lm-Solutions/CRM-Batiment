import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { CompanyService } from './company.service';
import { UpdateCompanyDto, UpdateCompanySettingsDto } from './dto/company.dto';

@ApiTags('Entreprise')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('company')
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  @Roles(...STAFF)
  @Get()
  @ApiOperation({ summary: 'Coordonnées de l’entreprise (en-têtes de devis et factures)' })
  getProfile(@CurrentUser() user: AuthUser) {
    return this.company.getProfile(user);
  }

  @Patch()
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateCompanyDto) {
    return this.company.updateProfile(user, dto);
  }

  @Roles(...STAFF)
  @Get('settings')
  @ApiOperation({
    summary: 'Réglages de chiffrage : TVA, acompte, marge cible, seuil d’alerte, arrondi',
  })
  getSettings(@CurrentUser() user: AuthUser) {
    return this.company.getSettings(user);
  }

  @Patch('settings')
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateCompanySettingsDto) {
    return this.company.updateSettings(user, dto);
  }
}
