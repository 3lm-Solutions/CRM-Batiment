import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Roles allowed on a controller or a route (route-level overrides controller-level).
 * A protected route WITHOUT @Roles is refused (403): access must always be explicit.
 *
 * @example @Roles(Role.ADMIN, Role.TECHNICO)   @Roles(...STAFF)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
