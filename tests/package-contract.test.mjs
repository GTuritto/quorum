import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_PACKAGE_FILES,
  assertExactPackageFiles,
  packFilePaths,
} from "../scripts/package-contract.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function runNpm(args) {
  const npmCli = process.env.npm_execpath;
  assert.ok(npmCli, "npm_execpath must be available under npm test");
  return execFileSync(process.execPath, [npmCli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("npm dry-run contains exactly the approved package files", () => {
  const [packResult] = JSON.parse(runNpm(["pack", "--dry-run", "--json"]));
  const actual = packFilePaths(packResult);

  assert.deepEqual(actual, EXPECTED_PACKAGE_FILES);
  assert.doesNotThrow(() => assertExactPackageFiles(actual));
  for (const runtimeModule of [
    "installer/detection.mjs",
    "installer/identity.mjs",
    "installer/uninstall.mjs",
    "installer/version.mjs",
  ]) {
    assert.equal(actual.includes(runtimeModule), true, `${runtimeModule} must be published`);
  }
});

test("exact package contract reports missing and unexpected files", () => {
  assert.throws(
    () => assertExactPackageFiles(EXPECTED_PACKAGE_FILES.slice(1)),
    /Missing package files: LICENSE/,
  );
  assert.throws(
    () => assertExactPackageFiles([...EXPECTED_PACKAGE_FILES, "tests/leak.test.mjs"]),
    /Unexpected package files: tests\/leak\.test\.mjs/,
  );
});
