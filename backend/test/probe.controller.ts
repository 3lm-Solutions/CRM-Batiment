import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '../src/generated/prisma/client';
import {
  type AuthUser,
  BusinessException,
  CurrentUser,
  paginate,
  PaginationQueryDto,
  Public,
  Roles,
  toDecimal,
} from '../src/common';

/** Test-only controller that exercises every piece of the common layer through real HTTP. */
@Controller('probe')
export class ProbeController {
  @Public()
  @Get('public')
  open() {
    return { ok: true };
  }

  @Roles(Role.ADMIN)
  @Get('admin')
  adminOnly(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get('no-roles')
  forgotRoles() {
    return { leaked: true };
  }

  @Public()
  @Get('business')
  business() {
    throw new BusinessException('DEVIS_SANS_LIGNES', 'Impossible de signer un devis sans lignes.');
  }

  @Public()
  @Get('decimal')
  decimal() {
    return { totalHT: toDecimal('1250.50'), lignes: [{ quantite: toDecimal('14.5') }] };
  }

  @Public()
  @Get('list')
  list(@Query() query: PaginationQueryDto) {
    return paginate([], 42, query);
  }

  @Public()
  @Get('crash')
  crash() {
    throw new Error('internal detail that must not leak');
  }
}
