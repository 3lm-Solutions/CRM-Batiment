type DateValue = string | Date | null | undefined;

/**
 * Turns the given date fields of a DTO into Date objects before they reach Prisma.
 * A date without a time ("2026-11-10", what a date picker or the mobile sends) passes
 * @IsDateString but Prisma refuses it as a DateTime and the request ends in a 500.
 * null (clear the date) and undefined (leave it as it is) are kept.
 */
export function toDates<T extends object, K extends keyof T>(
  dto: T,
  keys: readonly K[],
): Omit<T, K> & { [P in K]?: Date | null } {
  const out = { ...dto } as Record<string, unknown>;
  for (const key of keys) {
    const value = dto[key] as DateValue;
    if (value !== undefined) out[key as string] = value === null ? null : new Date(value);
  }
  return out as Omit<T, K> & { [P in K]?: Date | null };
}
