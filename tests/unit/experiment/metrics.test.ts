import { test } from "node:test";
import assert from "node:assert/strict";
import {
  summarize,
  experimentSummary,
} from "../../../src/shared/experiment/index";
test("5-day comparison uses raw sums before final rounding and separate 2/3-day divisors", () => {
  const state = {
    experiment: { rules_json: JSON.stringify({ decimals: 1 }) },
    days: [10, 20, 30, 40, 50].map((value) => ({ value })),
  };
  const result = experimentSummary(state as never);
  assert.deepEqual(result.before, {
    count: 2,
    sum: 30,
    average: 15,
    rawSum: 30,
  });
  assert.equal(result.after.average, 40);
  assert.equal(result.total.sum, 150);
  assert.equal(result.total.average, 30);
  assert.equal(summarize([0.14, 0.14], 1).sum, 0.3);
  assert.equal(summarize([], 1).average, null);
  assert.equal(summarize([0], 1).average, 0);
});
