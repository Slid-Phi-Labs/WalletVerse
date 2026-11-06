import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isIntegerCents,
  checkIntegerCents,
  isNonNegativeAmount,
  roundToCents,
} from "../lib/money.ts";

describe("integer-cents validation", () => {
  it("accepts non-negative integer cents", () => {
    assert.equal(isIntegerCents(0), true);
    assert.equal(isIntegerCents(1), true);
    assert.equal(isIntegerCents(999999), true);
    assert.deepEqual(checkIntegerCents(250, "amount_cents"), { ok: true, value: 250 });
  });

  it("rejects fractional money", () => {
    assert.equal(isIntegerCents(4.5), false);
    const res = checkIntegerCents(19.99, "unit_cost_cents");
    assert.equal(res.ok, false);
    assert.match(res.ok ? "" : res.error, /integer/);
  });

  it("rejects negative money", () => {
    assert.equal(isIntegerCents(-1), false);
    const res = checkIntegerCents(-5, "threshold_cents");
    assert.equal(res.ok, false);
    assert.match(res.ok ? "" : res.error, />= 0/);
  });

  it("rejects non-numbers", () => {
    for (const bad of ["5", null, undefined, true, NaN, Infinity, {}, []]) {
      assert.equal(isIntegerCents(bad), false);
      assert.equal(checkIntegerCents(bad, "amount_cents").ok, false);
    }
  });
});

describe("quantities and rounding", () => {
  it("allows fractional measured quantities but never negatives", () => {
    assert.equal(isNonNegativeAmount(1.5), true);
    assert.equal(isNonNegativeAmount(0), true);
    assert.equal(isNonNegativeAmount(-0.5), false);
    assert.equal(isNonNegativeAmount(NaN), false);
    assert.equal(isNonNegativeAmount("3"), false);
  });

  it("rounds aggregates to whole cents", () => {
    assert.equal(roundToCents(10.4), 10);
    assert.equal(roundToCents(10.5), 11);
    assert.equal(roundToCents(0), 0);
  });
});
