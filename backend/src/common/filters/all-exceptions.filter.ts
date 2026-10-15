import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';
import type { ApiErrorResponse } from '../../shared';
import { Prisma } from '../../generated/prisma/client';
import type { AppRequest } from '../auth/auth-user.interface';

interface HttpError {
  status: number;
  message: string | string[];
  code?: string;
}

/**
 * Turns ANY thrown error into the standard ApiErrorResponse shape.
 *
 * Main gain vs the old project: Prisma errors no longer become opaque 500s.
 *   P2002 unique constraint   -> 409 DUPLICATE
 *   P2003 foreign key (Restrict) -> 409 RESOURCE_IN_USE  (e.g. deleting a material used in a quote)
 *   P2025 record not found    -> 404 NOT_FOUND
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<AppRequest>();
    const response = http.getResponse<Response>();

    const { status, message, code } = toHttpError(exception);

    const body: ApiErrorResponse = {
      statusCode: status,
      error: STATUS_CODES[status] ?? 'Error',
      message,
      ...(code ? { code } : {}),
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} [${request.requestId ?? '-'}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }
}

/** Pure mapping function — exported so it can be unit-tested without HTTP. */
export function toHttpError(exception: unknown): HttpError {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const res = exception.getResponse();
    if (typeof res === 'string') return { status, message: frenchFrameworkMessage(status, res) };

    const { message, code } = res as { message?: string | string[]; code?: string };
    return { status, message: frenchFrameworkMessage(status, message ?? exception.message), code };
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    return fromPrismaError(exception);
  }

  // Unknown error: never leak internals to the client (they are logged instead)
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Erreur interne du serveur',
    code: 'INTERNAL_ERROR',
  };
}

/**
 * Messages written by NestJS / Express / the throttler themselves are in English
 * ("ThrottlerException: Too Many Requests", "Cannot GET /x", "Validation failed (numeric string
 * is expected)"…): the user gets a French sentence instead. Our own messages are untouched.
 */
export function frenchFrameworkMessage(status: number, message: string | string[]): string | string[] {
  if (Array.isArray(message)) return message;
  if (status === 429) return 'Trop de demandes en peu de temps. Patientez une minute puis réessayez.';
  if (status === 413) return 'Fichier ou données trop volumineux.';
  if (/^Cannot (GET|POST|PUT|PATCH|DELETE) /.test(message)) return 'Adresse introuvable.';
  if (/^Validation failed \((numeric|boolean|uuid|enum)/.test(message)) return 'Identifiant ou paramètre invalide dans l’adresse.';
  if (/^Unexpected token|JSON/.test(message) && status === 400) return 'Données envoyées illisibles (format JSON invalide).';
  if (message === 'Unauthorized') return 'Authentification requise.';
  if (message === 'Forbidden' || message === 'Forbidden resource') return 'Vous n’avez pas les droits pour cette action.';
  if (message === 'Not Found') return 'Ressource introuvable.';
  if (message === 'Bad Request') return 'Requête invalide.';
  return message;
}

function fromPrismaError(error: Prisma.PrismaClientKnownRequestError): HttpError {
  switch (error.code) {
    case 'P2002': {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target.join(', ') : typeof target === 'string' ? target : '';
      return {
        status: HttpStatus.CONFLICT,
        message: fields
          ? `Un enregistrement avec cette valeur existe déjà (${fields}).`
          : 'Un enregistrement avec cette valeur existe déjà.',
        code: 'DUPLICATE',
      };
    }
    case 'P2003':
      return {
        status: HttpStatus.CONFLICT,
        message: "Opération impossible : cet élément est utilisé ailleurs. Désactivez-le plutôt que de le supprimer.",
        code: 'RESOURCE_IN_USE',
      };
    case 'P2025':
      return { status: HttpStatus.NOT_FOUND, message: 'Ressource introuvable.', code: 'NOT_FOUND' };
    case 'P2000':
      return { status: HttpStatus.BAD_REQUEST, message: 'Une valeur est trop longue.', code: 'VALUE_TOO_LONG' };
    default:
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Erreur de base de données',
        code: `DB_${error.code}`,
      };
  }
}
