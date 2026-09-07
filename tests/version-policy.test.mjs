import assert from "node:assert/strict";
import test from "node:test";

import {
  compareSemanticVersions,
  parseSemanticVersion,
} from "../installer/version.mjs";

test("accepts only strict three-part semantic versions", () => {
  assert.deepEqual(parseSemanticVersion("0.1.59"), [0, 1, 59]);
  assert.deepEqual(parseSemanticVersion("10.20.30\n"), [10, 20, 30]);
  assert.equal(parseSemanticVersion("v0.1.59"), null);
  assert.equal(parseSemanticVersion("0.1"), null);
  assert.equal(parseSemanticVersion("0.1.59-beta"), null);
});

test("compares semantic-version components numerically", () => {
  assert.equal(compareSemanticVersions("0.1.58", "0.1.59"), -1);
  assert.equal(compareSemanticVersions("0.1.59", "0.1.59"), 0);
  assert.equal(compareSemanticVersions("0.2.0", "0.1.59"), 1);
  assert.equal(compareSemanticVersions("1.0.0", "0.99.99"), 1);
  assert.throws(() => compareSemanticVersions("0.1", "0.1.59"), /invalid semantic version/i);
});
