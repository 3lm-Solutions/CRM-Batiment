import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../../common';
import { PublicDevisService } from './public-devis.service';
import { RefuserDevisDto, SignerClientDto, VerifierCodeDto } from './public-devis.dto';

const READ = { default: { limit: 30, ttl: 60_000 } };
const WRITE = { default: { limit: 5, ttl: 60_000 } };
const CODE = { default: { limit: 3, ttl: 60_000 } };

/** Routes used by the client page opened from the email link. No authentication: the token is the credential. */
@ApiTags('Devis — lien client (public)')
@Public()
@Controller('public/devis')
export class PublicDevisController {
  constructor(private readonly publicDevis: PublicDevisService) {}

  @Throttle(READ)
  @Get(':token')
  @ApiOperation({ summary: 'Devis vu par le client (sans coûts ni marges) + actions possibles' })
  view(@Param('token') token: string) {
    return this.publicDevis.view(token);
  }

  @Throttle(WRITE)
  @Post(':token/accepter')
  @HttpCode(HttpStatus.OK)
  accepter(@Param('token') token: string) {
    return this.publicDevis.accepter(token);
  }

  @Throttle(WRITE)
  @Post(':token/refuser')
  @HttpCode(HttpStatus.OK)
  refuser(@Param('token') token: string, @Body() dto: RefuserDevisDto) {
    return this.publicDevis.refuser(token, dto.motif);
  }

  @Throttle(CODE)
  @Post(':token/code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recevoir le code de signature par email' })
  demanderCode(@Param('token') token: string) {
    return this.publicDevis.demanderCode(token);
  }

  @Throttle(WRITE)
  @Post(':token/code/verifier')
  @HttpCode(HttpStatus.OK)
  verifierCode(@Param('token') token: string, @Body() dto: VerifierCodeDto) {
    return this.publicDevis.verifierCode(token, dto.code);
  }

  @Throttle(WRITE)
  @Post(':token/signer')
  @HttpCode(HttpStatus.OK)
  signer(@Param('token') token: string, @Body() dto: SignerClientDto) {
    return this.publicDevis.signer(token, dto.signatureBase64);
  }
}
