import assert from "node:assert/strict";
import test from "node:test";

import {
  compareSemanticVersions,
  parseSemanticVersion,
} from "../installer/version.mjs";
import { classifyDestination } from "../installer/install.mjs";

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

test("classifies eligible updates, current content, and missing destinations", () => {
  const base = { sourceVersion: "0.1.59", kind: "directory", recognized: true };
  assert.deepEqual(
    classifyDestination({ ...base, installedVersion: "0.1.58", contentMatches: false }, "update"),
    { action: "update", requiresConfirmation: true, reason: "older version" },
  );
  assert.deepEqual(
    classifyDestination({ ...base, installedVersion: "0.1.59", contentMatches: true }, "update"),
    { status: "skipped", reason: "already current" },
  );
  assert.deepEqual(
    classifyDestination({ ...base, installedVersion: "0.1.59", contentMatches: false }, "install"),
    { action: "update", requiresConfirmation: true, reason: "modified content" },
  );
  assert.deepEqual(
    classifyDestination({ ...base, kind: "missing", recognized: false }, "install"),
    { action: "install", requiresConfirmation: false },
  );
  assert.deepEqual(
    classifyDestination({ ...base, kind: "missing", recognized: false }, "update"),
    { status: "skipped", reason: "not installed" },
  );
});

test("refuses downgrades, foreign content, and update symlinks", () => {
  const base = { sourceVersion: "0.1.59", kind: "directory", recognized: true };
  assert.deepEqual(
    classifyDestination({ ...base, installedVersion: "0.2.0" }, "update"),
    { status: "refused", reason: "installed version 0.2.0 is newer than source 0.1.59" },
  );
  assert.deepEqual(
    classifyDestination({ ...base, recognized: false }, "install"),
    { status: "refused", reason: "foreign content" },
  );
  assert.deepEqual(
    classifyDestination({ ...base, kind: "symlink" }, "update"),
    { status: "refused", reason: "symbolic link" },
  );
});

test("requires confirmation when a recognized installation has an unknown version", () => {
  assert.deepEqual(classifyDestination({
    sourceVersion: "0.1.59",
    kind: "directory",
    recognized: true,
    installedVersion: null,
    contentMatches: false,
  }, "update"), {
    action: "update",
    requiresConfirmation: true,
    reason: "unknown installed version",
  });
});
