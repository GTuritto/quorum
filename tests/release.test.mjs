import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveReleaseVersion, verifyRelease } from "../scripts/verify-release.mjs";

const base = { packageVersion: "0.1.60" };

test("release tag selects its version, independently of manual input", () => {
  assert.equal(resolveReleaseVersion({ ...base, eventName: "push", ref: "refs/tags/v0.1.60", requestedVersion: "9.9.9" }), "0.1.60");
});

test("manual release remains available only on main", () => {
  assert.equal(resolveReleaseVersion({ ...base, eventName: "workflow_dispatch", ref: "refs/heads/main", requestedVersion: "0.1.60" }), "0.1.60");
  for (const ref of ["refs/heads/feature", "refs/tags/v0.1.60"]) {
    assert.throws(() => resolveReleaseVersion({ ...base, eventName: "workflow_dispatch", ref, requestedVersion: "0.1.60" }), /manual dispatch on main/);
  }
});

test("invalid tags, branch pushes, and mismatched versions cannot publish", () => {
  for (const ref of ["refs/tags/v0.1.61", "refs/tags/v0.1.60-beta", "refs/tags/v01.1.60", "refs/tags/v0.1", "refs/tags/v0.1.60\nextra", "refs/heads/main"]) {
    assert.throws(() => resolveReleaseVersion({ ...base, eventName: "push", ref }));
  }
  assert.throws(() => resolveReleaseVersion({ ...base, eventName: "pull_request", ref: "refs/tags/v0.1.60" }));
  assert.throws(() => resolveReleaseVersion({ ...base, eventName: "workflow_dispatch", ref: "refs/heads/main", requestedVersion: "0.1.60\nversion=9.0.0" }));
});

test("release verification accepts merged tags but rejects unmerged commits without output", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "quorum-release-"));
  const output = path.join(cwd, "release-output");
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    git("init", "-b", "main");
    git("config", "user.email", "test@example.invalid");
    git("config", "user.name", "Release Test");
    writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ version: "0.1.60" }));
    git("add", "package.json");
    git("-c", "commit.gpgsign=false", "commit", "-m", "initial");
    const merged = git("rev-parse", "HEAD").trim();
    git("tag", "v0.1.60");
    git("update-ref", "refs/remotes/origin/main", merged);
    git("checkout", "--detach", "v0.1.60");
    const env = { GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/tags/v0.1.60", GITHUB_OUTPUT: output };
    assert.equal(verifyRelease({ cwd, env }), "0.1.60");
    assert.equal(readFileSync(output, "utf8"), "version=0.1.60\n");

    writeFileSync(output, "");
    git("-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", "unmerged");
    assert.throws(() => verifyRelease({ cwd, env }));
    assert.equal(readFileSync(output, "utf8"), "");
    git("update-ref", "-d", "refs/remotes/origin/main");
    assert.throws(() => verifyRelease({ cwd, env }));
    assert.equal(readFileSync(output, "utf8"), "");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
