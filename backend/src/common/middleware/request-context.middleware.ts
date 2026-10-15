import { Logger } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { AppRequest } from '../auth/auth-user.interface';

const SAFE_REQUEST_ID = /^[\w-]{1,64}$/;

/**
 * 1. Gives every request an ID (reuses a valid incoming X-Request-Id, e.g. from a proxy),
 *    returns it in the X-Request-Id response header and in every error body.
 * 2. Logs one line per request when it finishes: method, URL, status, duration, user.
 *
 * When a user reports a bug, the request ID finds the exact log line.
 */
export function createRequestContextMiddleware(options: { log: boolean }) {
  const logger = new Logger('HTTP');

  return (req: AppRequest, res: Response, next: NextFunction): void => {
    const incoming = req.header('x-request-id');
    const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    if (options.log) {
      const start = process.hrtime.bigint();
      res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms user=${req.user?.id ?? '-'} [${requestId}]`;
        if (res.statusCode >= 500) logger.error(line);
        else if (res.statusCode >= 400) logger.warn(line);
        else logger.log(line);
      });
    }

    next();
  };
}
