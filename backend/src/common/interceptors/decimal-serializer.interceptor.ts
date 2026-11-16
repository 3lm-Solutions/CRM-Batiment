import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { Prisma } from '../../generated/prisma/client';

/**
 * Prisma returns money columns as Decimal objects, which JSON.stringify turns into STRINGS
 * ("totalHT": "1250.5"). The frontend expects numbers, so this global interceptor converts
 * every Decimal in every response to a number.
 *
 * Calculations stay in Decimal on the server (see common/money) — only the JSON output
 * becomes a number. Two-decimal amounts are exactly representable for display.
 */
@Injectable()
export class DecimalSerializerInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(serializeDecimals));
  }
}

export function serializeDecimals(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Prisma.Decimal.isDecimal(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(serializeDecimals);

  // Only walk plain objects: leave Dates, Buffers, StreamableFile (PDF downloads)… untouched
  const proto = Object.getPrototypeOf(value) as unknown;
  if (proto !== Object.prototype && proto !== null) return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) result[key] = serializeDecimals(item);
  return result;
}
