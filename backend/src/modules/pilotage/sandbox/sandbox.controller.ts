import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common';
import { DemoConnexionDto } from './dto/sandbox.dto';
import { SandboxService } from './sandbox.service';

/** Public: the login page asks whether this instance is the demo, then opens a session. */
@ApiTags('Démo en ligne (bac à sable)')
@Public()
@Controller('public/demo')
export class SandboxController {
  constructor(private readonly sandbox: SandboxService) {}

  @Get()
  @ApiOperation({ summary: 'Cette instance est-elle la démo ? (comptes proposés, heure de réinitialisation)' })
  info() {
    return this.sandbox.info();
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('connexion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Démo uniquement : session pour le rôle choisi, sans mot de passe (404 hors démo)' })
  connexion(@Body() dto: DemoConnexionDto) {
    return this.sandbox.connexion(dto.role);
  }
}
