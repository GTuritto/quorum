import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const entryPoint = path.join(root, "installer", "install.mjs");

test("the real entry point reports the supported Node.js boundary", () => {
  const result = spawnSync(process.execPath, [entryPoint, "--help"], {
    encoding: "utf8",
  });
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);

  if (major < 18) {
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^Error: Quorum requires Node\.js 18 or later; found /);
    assert.doesNotMatch(result.stderr, /ERR_UNKNOWN_BUILTIN_MODULE/);
    return;
  }

  assert.equal(result.status, 0);
  assert.match(result.stdout, /QUORUM v0\.1\.58/);
  assert.match(result.stdout, /quorum-skill \[options\]/);
  assert.equal(result.stderr, "");
});
