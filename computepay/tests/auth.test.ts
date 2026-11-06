import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getAdminCode,
  isAdminConfigured,
  verifyAdminCode,
  getBearerToken,
  requireWorkspaceAuth,
} from "../lib/auth.ts";

const savedAdmin = process.env.ADMIN_CODE;
const savedKey = process.env.WORKSPACE_API_KEY;

function headers(auth?: string) {
  return { get: (name: string) => (name === "authorization" ? (auth ?? null) : null) };
}

beforeEach(() => {
  delete process.env.ADMIN_CODE;
  delete process.env.WORKSPACE_API_KEY;
});

afterEach(() => {
  if (savedAdmin === undefined) delete process.env.ADMIN_CODE;
  else process.env.ADMIN_CODE = savedAdmin;
  if (savedKey === undefined) delete process.env.WORKSPACE_API_KEY;
  else process.env.WORKSPACE_API_KEY = savedKey;
});

describe("admin gate refuses closed without ADMIN_CODE", () => {
  it("reports unconfigured and rejects every code", () => {
    assert.equal(getAdminCode(), undefined);
    assert.equal(isAdminConfigured(), false);
    assert.equal(verifyAdminCode("lab-owner-change-me"), false);
    assert.equal(verifyAdminCode("anything"), false);
    assert.equal(verifyAdminCode(""), false);
  });

  it("treats a blank ADMIN_CODE as unset", () => {
    process.env.ADMIN_CODE = "   ";
    assert.equal(isAdminConfigured(), false);
    assert.equal(verifyAdminCode("   "), false);
  });
});

describe("admin gate with ADMIN_CODE set", () => {
  it("accepts the exact secret, rejects everything else", () => {
    process.env.ADMIN_CODE = "s3cret-owner-code";
    assert.equal(isAdminConfigured(), true);
    assert.equal(verifyAdminCode("s3cret-owner-code"), true);
    assert.equal(verifyAdminCode("wrong"), false);
    assert.equal(verifyAdminCode("s3cret-owner-code!"), false);
    assert.equal(verifyAdminCode(""), false);
    assert.equal(verifyAdminCode(null), false);
    assert.equal(verifyAdminCode(undefined), false);
    assert.equal(verifyAdminCode(123), false);
    assert.equal(verifyAdminCode({}), false);
  });
});

describe("workspace bearer auth", () => {
  it("refuses closed (503) when WORKSPACE_API_KEY is unset", () => {
    const res = requireWorkspaceAuth(headers("Bearer abc"));
    assert.equal(res.ok, false);
    assert.equal(res.ok ? 0 : res.status, 503);
  });

  it("rejects missing or malformed credentials", () => {
    process.env.WORKSPACE_API_KEY = "ws-key-1";
    assert.equal(requireWorkspaceAuth(headers()).ok, false);
    assert.equal(
      requireWorkspaceAuth(headers("Token ws-key-1")).ok,
      false
    );
    assert.equal(requireWorkspaceAuth(headers("Bearer ")).ok, false);
    const wrong = requireWorkspaceAuth(headers("Bearer nope"));
    assert.equal(wrong.ok, false);
    assert.equal(wrong.ok ? 0 : wrong.status, 403);
  });

  it("accepts the exact workspace key", () => {
    process.env.WORKSPACE_API_KEY = "ws-key-1";
    assert.deepEqual(requireWorkspaceAuth(headers("Bearer ws-key-1")), { ok: true });
  });

  it("parses bearer tokens", () => {
    assert.equal(getBearerToken(headers("Bearer abc123")), "abc123");
    assert.equal(getBearerToken(headers("bearer abc123")), "abc123");
    assert.equal(getBearerToken(headers()), undefined);
    assert.equal(getBearerToken(headers("Basic abc")), undefined);
  });
});
