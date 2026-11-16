import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { BusinessException } from '../exceptions/business.exception';
import { frenchFrameworkMessage, toHttpError } from './all-exceptions.filter';

const prismaError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('db error', { code, clientVersion: 'test', meta });

describe('toHttpError', () => {
  it('keeps Nest HTTP exceptions', () => {
    expect(toHttpError(new ForbiddenException('Non'))).toMatchObject({
      status: 403,
      message: 'Non',
    });
    expect(toHttpError(new NotFoundException()).status).toBe(404);
  });

  it('keeps the business code', () => {
    expect(toHttpError(new BusinessException('DEVIS_SANS_LIGNES', 'Pas de lignes'))).toEqual({
      status: 422,
      message: 'Pas de lignes',
      code: 'DEVIS_SANS_LIGNES',
    });
  });

  it('maps a unique violation to 409 DUPLICATE', () => {
    const err = toHttpError(prismaError('P2002', { target: ['reference'] }));
    expect(err).toMatchObject({ status: 409, code: 'DUPLICATE' });
    expect(err.message).toContain('reference');
  });

  it('maps a foreign-key violation (Restrict) to 409 RESOURCE_IN_USE', () => {
    expect(toHttpError(prismaError('P2003'))).toMatchObject({
      status: 409,
      code: 'RESOURCE_IN_USE',
    });
  });

  it('maps record-not-found to 404', () => {
    expect(toHttpError(prismaError('P2025'))).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(toHttpError(prismaError('P2022'))).toMatchObject({
      status: 500,
      code: 'BASE_PAS_A_JOUR',
    });
  });

  it('hides unknown errors behind a generic 500', () => {
    expect(toHttpError(new Error('secret stack detail'))).toEqual({
      status: 500,
      message: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    });
  });

  it('translates English messages written by the framework', () => {
    expect(frenchFrameworkMessage(429, 'ThrottlerException: Too Many Requests')).toMatch(
      /Trop de demandes/,
    );
    expect(frenchFrameworkMessage(404, 'Cannot GET /api/v1/nope')).toBe('Adresse introuvable.');
    expect(frenchFrameworkMessage(400, 'Validation failed (numeric string is expected)')).toMatch(
      /Identifiant/,
    );
    expect(frenchFrameworkMessage(422, 'Pas de lignes')).toBe('Pas de lignes');
  });
});
