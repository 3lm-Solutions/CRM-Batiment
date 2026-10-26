import { Transform } from 'class-transformer';

/**
 * Reusable DTO transforms. Every module uses these instead of re-writing inline lambdas.
 *
 * Why ToBoolean exists: `enableImplicitConversion` and `@Type(() => Boolean)` both turn the
 * query string "false" into `true` (non-empty string). The old materiaux/fournisseurs filters
 * had exactly that bug: `?actif=false` returned the ACTIVE items.
 */

/** Trims strings; empty string becomes undefined (= "not provided"). */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  });

/** Trims; empty string becomes null — for optional fields the user can CLEAR in a PATCH. */
export const TrimOrNull = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });

export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || undefined : value,
  );

/**
 * "true"/"1" → true, "false"/"0" → false. Anything else is left for @IsBoolean to reject.
 *
 * Reads the RAW value (`obj[key]`), not `value`: the global ValidationPipe runs with
 * `enableImplicitConversion`, which has already turned "false" into `true` for a
 * `boolean` property before this transform runs (catalogue « Inactifs » filter bug, 20/10).
 */
export const ToBoolean = () =>
  Transform(({ value, obj, key }: { value: unknown; obj: Record<string, unknown>; key: string }) => {
    const raw = obj && typeof obj === 'object' && key in obj ? obj[key] : value;
    if (raw === 'true' || raw === '1' || raw === true) return true;
    if (raw === 'false' || raw === '0' || raw === false) return false;
    return raw;
  });

/** "1,2,3" or ["1","2"] → [1, 2, 3] (query strings and bodies alike). */
export const ToIntArray = () =>
  Transform(({ value }: { value: unknown }) => {
    const items = typeof value === 'string' ? value.split(',') : value;
    return Array.isArray(items) ? items.map((v) => Number(v)) : items;
  });

/** "A,B" → ["A", "B"] for enum lists in query strings. */
export const ToStringArray = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').map((v) => v.trim()) : value,
  );
