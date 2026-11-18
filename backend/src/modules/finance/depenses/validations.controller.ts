import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, FACTURATION, Roles } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DepensesService } from './depenses.service';

/**
 * 18/11 (mobile lot A): badges of the admin « Validations » screen (3 tabs).
 * Paper signatures are checked by the ADMIN only: null for the assistante.
 */
@ApiTags('Dépenses')
@ApiBearerAuth()
@Roles(...FACTURATION)
@Controller('validations')
export class ValidationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly depenses: DepensesService,
  ) {}

  @Get('compteurs')
  @ApiOperation({
    summary:
      'Nombre d’éléments à vérifier : signatures papier (admin), livraisons avec écarts, dépenses',
  })
  async compteurs(@CurrentUser() user: AuthUser) {
    const [signaturesPapier, livraisons, depenses] = await Promise.all([
      user.role === Role.ADMIN
        ? this.prisma.devis.count({ where: { companyId: user.companyId, statut: 'SIGNE_PAPIER' } })
        : Promise.resolve(null),
      this.prisma.reception.count({
        where: { statutControle: 'A_VERIFIER', commandeFournisseur: { companyId: user.companyId } },
      }),
      this.depenses.aValider(user.companyId),
    ]);
    return { signaturesPapier, livraisons, depenses };
  }
}
