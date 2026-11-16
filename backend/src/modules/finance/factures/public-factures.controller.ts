import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common';
import { FacturesService } from './factures.service';

/** QR code « voir la facture en ligne » printed on the invoice (21/10). The token is the credential. */
@ApiTags('Factures (public)')
@Public()
@Controller('public/factures')
export class PublicFacturesController {
  constructor(private readonly factures: FacturesService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':token')
  @ApiOperation({
    summary: 'Facture émise, en lecture seule (lien / QR code imprimé sur la facture)',
  })
  voir(@Param('token') token: string) {
    return this.factures.findPublic(token);
  }
}
