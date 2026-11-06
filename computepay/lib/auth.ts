import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Shared trust gates for ComputePay money routes.
 *
 * - Admin unlock refuses closed when ADMIN_CODE is unset (no default code).
 * - Every money route requires a workspace bearer token (WORKSPACE_API_KEY).
 *   The service refuses closed (503) when the key is unset instead of
 *   serving billing data unauthenticated.
 */

export function getAdminCode(): string | undefined {
  const raw = process.env.ADMIN_CODE;
  if (raw === undefined || raw.trim() === "") return undefined;
  return raw;
}

export function isAdminConfigured(): boolean {
  return getAdminCode() !== undefined;
}

function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

/** True only when the admin secret is configured AND the candidate matches. */
export function verifyAdminCode(code: unknown): boolean {
  const expected = getAdminCode();
  if (expected === undefined) return false;
  if (typeof code !== "string" || code === "") return false;
  return constantTimeEqual(code, expected);
}

export function getWorkspaceApiKey(): string | undefined {
  const raw = process.env.WORKSPACE_API_KEY;
  if (raw === undefined || raw.trim() === "") return undefined;
  return raw;
}

export interface MinimalHeaders {
  get(name: string): string | null;
}

export function getBearerToken(headers: MinimalHeaders): string | undefined {
  const raw = headers.get("authorization");
  if (!raw) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  if (!match) return undefined;
  const token = match[1].trim();
  return token === "" ? undefined : token;
}

export type WorkspaceAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** Gate for every money route: closed (503) when unconfigured, else bearer check. */
export function requireWorkspaceAuth(headers: MinimalHeaders): WorkspaceAuthResult {
  const key = getWorkspaceApiKey();
  if (key === undefined) {
    return {
      ok: false,
      status: 503,
      error: "workspace auth not configured (WORKSPACE_API_KEY is not set)",
    };
  }
  const token = getBearerToken(headers);
  if (!token) {
    return { ok: false, status: 401, error: "missing bearer token" };
  }
  if (!constantTimeEqual(token, key)) {
    return { ok: false, status: 403, error: "invalid workspace token" };
  }
  return { ok: true };
}
