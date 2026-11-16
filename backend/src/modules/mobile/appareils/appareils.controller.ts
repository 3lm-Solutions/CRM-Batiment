import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ALL_ROLES, type AuthUser, CurrentUser, Roles } from '../../../common';
import { EnregistrerAppareilDto } from './appareils.dto';
import { AppareilsService } from './appareils.service';

/** Mobile app only (16/11): register the phone for push notifications. Every role. */
@ApiTags('Mobile')
@ApiBearerAuth()
@Roles(...ALL_ROLES)
@Controller('mobile/appareils')
export class AppareilsController {
  constructor(private readonly appareils: AppareilsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enregistrer ce téléphone pour les notifications push (jeton Expo)' })
  enregistrer(@CurrentUser() user: AuthUser, @Body() dto: EnregistrerAppareilDto) {
    return this.appareils.enregistrer(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Mes téléphones enregistrés' })
  mesAppareils(@CurrentUser() user: AuthUser) {
    return this.appareils.mesAppareils(user);
  }

  @Delete(':jeton')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ne plus recevoir de push sur ce téléphone (jeton encodé dans l’URL)' })
  retirer(@CurrentUser() user: AuthUser, @Param('jeton') jeton: string) {
    return this.appareils.retirer(user, jeton);
  }
}
