/**
 * Integer-cents money validation.
 *
 * Every amount of money in ComputePay is an integer number of cents.
 * Fractional or negative money is rejected at the API boundary (400)
 * instead of being silently truncated by the database.
 */

export function isIntegerCents(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export type CentsResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

export function checkIntegerCents(value: unknown, name: string): CentsResult {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, error: `${name} must be a number` };
  }
  if (!Number.isInteger(value)) {
    return {
      ok: false,
      error: `${name} must be an integer number of cents (fractional money rejected)`,
    };
  }
  if (value < 0) {
    return { ok: false, error: `${name} must be >= 0` };
  }
  return { ok: true, value };
}

/** Measured usage quantities (tokens, gpu_seconds) may be fractional, never negative. */
export function isNonNegativeAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Aggregate math (SUM over fractional quantities) rounds to whole cents. */
export function roundToCents(value: number): number {
  return Math.round(value);
}
