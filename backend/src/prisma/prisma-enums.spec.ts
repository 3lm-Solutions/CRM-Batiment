import { Role as SharedRole } from '../shared';
import { Role as PrismaRole } from '../generated/prisma/client';

/**
 * Guards against the classic bug: a role added to Prisma but not to the frontend
 * (or the reverse). If this test fails, update src/shared/roles.ts here AND in crm-batiment-web.
 */
describe('Prisma enums ↔ src/shared', () => {
  it('Role values are identical', () => {
    expect(Object.values(SharedRole).sort()).toEqual(Object.values(PrismaRole).sort());
  });
});
