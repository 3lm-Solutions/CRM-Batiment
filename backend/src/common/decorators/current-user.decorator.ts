import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AppRequest, AuthUser } from '../auth/auth-user.interface';

/**
 * Injects the authenticated user (or one of its fields).
 *
 * @example
 *   findAll(@CurrentUser() user: AuthUser)
 *   findAll(@CurrentUser('companyId') companyId: number)
 *
 * companyId must ALWAYS come from here, never from the request body or query.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<AppRequest>().user;
    return field ? user?.[field] : user;
  },
);
