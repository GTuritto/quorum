# Quorum 0.1.59 Version, Update, and Uninstall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Completed and released on 2026-09-07.

**Goal:** Release `quorum-skill@0.1.59` with version reporting, conservative installation discovery, version-aware update and upgrade, explicit custom destinations, permanent uninstall, complete documentation, and verified npm provenance.

**Architecture:** Keep `installer/install.mjs` as the CLI orchestrator. Add focused modules for Quorum identity, semantic versions, target discovery, and guarded removal; extend the declarative target registry with conservative detection signals. Reuse the existing selector, payload copier, staged placement, backups, rollback, and per-destination isolation.

**Tech Stack:** Node.js 18+ ESM, built-in Node APIs, `node:test`, POSIX shell integration tests, npm package tooling, GitHub Actions OIDC trusted publishing, and GitHub CLI release tooling.

**Spec:** `docs/superpowers/specs/2026-09-07-version-update-uninstall-design.md`

## Global Constraints

- Keep the installer and published package free of third-party runtime dependencies.
- The installer performs no network requests; npm chooses the running package version.
- Keep `VERSION`, `package.json`, `SKILL.md`, the banner, README examples, tests, and release metadata at `0.1.59`.
- Preserve user and project destination paths plus shared-destination deduplication.
- Preserve the selector only for normal no-target runs with a managed installation.
- Refuse downgrades, foreign content, user-managed update symlinks, and changed-after-confirmation destinations, including with `--yes`.
- Install and update never modify the legacy Codex path.
- Uninstall permanently removes only recognized Quorum directories or links and never removes parents, siblings, backups, symlink targets, or a directory containing the current working directory.
- Return `0` for successful, skipped, or dry-run plans; `1` for invalid, refused, or failed work; and `130` for cancellation.
- Do not publish, tag, or create a GitHub release until the local release gate and remote trusted-publisher check pass.

---

## File map

- Create `installer/version.mjs`: strict three-part semantic-version parsing and comparison.
- Create `installer/identity.mjs`: path-kind inspection and narrow `SKILL.md` frontmatter identity parsing.
- Create `installer/detection.mjs`: managed, legacy, executable, application, and Copilot-extension discovery plus custom-path resolution.
- Create `installer/uninstall.mjs`: removal planning, identity revalidation, current-directory protection, and exact deletion.
- Modify `installer/targets.mjs`: declarative detection metadata and custom destination grouping.
- Modify `installer/install.mjs`: new CLI options, routing, source-version fast path, version policy, state revalidation, custom prompt, reporting, and operation dispatch.
- Create `tests/version-policy.test.mjs`: semantic-version and destination-policy tests.
- Create `tests/identity.test.mjs`: frontmatter and path identity tests.
- Create `tests/detection.test.mjs`: deterministic platform and routing-discovery fixtures.
- Create `tests/uninstall.test.mjs`: exact permanent-removal tests.
- Modify `tests/install.test.mjs`: CLI parsing, routing, update policy, reporting, and main-flow tests.
- Modify `tests/targets.test.mjs`: detection metadata and custom grouping tests.
- Modify `tests/distribution.test.mjs`, `tests/version.test.mjs`, `tests/package-contract.test.mjs`, and `tests/test-install.sh`: packed 0.1.59 behavior and integration coverage.
- Modify `scripts/package-contract.mjs` and `package.json`: publish the new runtime modules.
- Modify `README.md`, `CHANGELOG.md`, `PUBLISHING.md`, `ROADMAP.md`, `SKILL.md`, and `VERSION`: document and identify the release.

---

### Task 1: Version and Quorum identity primitives

**Files:**
- Create: `installer/version.mjs`
- Create: `installer/identity.mjs`
- Create: `tests/version-policy.test.mjs`
- Create: `tests/identity.test.mjs`

**Interfaces:**
- Produces: `parseSemanticVersion(value) -> [major, minor, patch] | null`
- Produces: `compareSemanticVersions(left, right) -> -1 | 0 | 1`
- Produces: `parseQuorumSkillName(text) -> string | null`
- Produces: `inspectQuorumPath(targetPath, io?) -> { kind, recognized, reason, resolvedPath? }`
- Consumes: built-in `node:fs/promises` and `node:path` only.

- [ ] **Step 1: Write failing semantic-version tests**

```js
test("parses and compares strict three-part versions", () => {
  assert.deepEqual(parseSemanticVersion("0.1.59"), [0, 1, 59]);
  assert.equal(parseSemanticVersion("v0.1.59"), null);
  assert.equal(parseSemanticVersion("0.1"), null);
  assert.equal(compareSemanticVersions("0.1.58", "0.1.59"), -1);
  assert.equal(compareSemanticVersions("0.1.59", "0.1.59"), 0);
  assert.equal(compareSemanticVersions("0.2.0", "0.1.59"), 1);
});
```

- [ ] **Step 2: Run the version test and verify import failure**

Run: `node --test tests/version-policy.test.mjs`

Expected: FAIL because `installer/version.mjs` does not exist.

- [ ] **Step 3: Implement strict parsing and comparison**

```js
export function parseSemanticVersion(value) {
  const match = String(value).trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

export function compareSemanticVersions(left, right) {
  const a = parseSemanticVersion(left);
  const b = parseSemanticVersion(right);
  if (!a || !b) throw new Error("Cannot compare invalid semantic versions");
  for (let index = 0; index < 3; index += 1) {
    if (a[index] < b[index]) return -1;
    if (a[index] > b[index]) return 1;
  }
  return 0;
}
```

- [ ] **Step 4: Write failing identity tests**

```js
test("recognizes only the frontmatter name field", () => {
  assert.equal(parseQuorumSkillName("---\nname: quorum\n---\n# Quorum\n"), "quorum");
  assert.equal(parseQuorumSkillName("---\nname: \"quorum\"\n---\n"), "quorum");
  assert.equal(parseQuorumSkillName("---\nname: other\n---\nquorum\n"), "other");
  assert.equal(parseQuorumSkillName("quorum\n"), null);
});

test("classifies missing, recognized, foreign, and symlink paths", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "quorum-identity-"));
  try {
    const destination = path.join(root, "quorum");
    await mkdir(destination);
    await writeFile(path.join(destination, "SKILL.md"), "---\nname: quorum\n---\n");
    assert.deepEqual(await inspectQuorumPath(destination), {
      kind: "directory",
      recognized: true,
      reason: "quorum skill",
    });
    assert.equal((await inspectQuorumPath(path.join(root, "missing", "quorum"))).kind, "missing");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 5: Run the identity test and verify import failure**

Run: `node --test tests/identity.test.mjs`

Expected: FAIL because `installer/identity.mjs` does not exist.

- [ ] **Step 6: Implement the narrow identity parser and inspector**

```js
export function parseQuorumSkillName(text) {
  const match = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const name = match[1].match(/^name:\s*(?:"([^"]+)"|'([^']+)'|([^#\s]+))\s*(?:#.*)?$/m);
  return name ? (name[1] ?? name[2] ?? name[3]) : null;
}
```

Implement `inspectQuorumPath` with `lstat`, `readFile`, and `realpath`. Require a final component named `quorum`; inspect a symlink target read-only; return a reason instead of throwing for missing `SKILL.md`; rethrow unexpected permission and I/O errors.

- [ ] **Step 7: Run focused tests**

Run: `node --test tests/version-policy.test.mjs tests/identity.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit the primitives**

```bash
git add installer/version.mjs installer/identity.mjs tests/version-policy.test.mjs tests/identity.test.mjs
git commit -m "feat(installer): add version and identity policies"
```

---

### Task 2: Declarative target and tool discovery

**Files:**
- Modify: `installer/targets.mjs`
- Create: `installer/detection.mjs`
- Modify: `tests/targets.test.mjs`
- Create: `tests/detection.test.mjs`

**Interfaces:**
- Consumes: `TARGETS`, `resolveDestination`, and `inspectQuorumPath`.
- Produces: `legacyCodexPath({ homeDir, env }) -> absolute path`
- Produces: `discoverInstallations({ targetIds, scope, homeDir, projectRoot, env }) -> { managed, legacy, foreign }`
- Produces: `detectTools({ env, homeDir, platform, pathApi, pathExists }) -> [{ targetId, evidence }]`
- Produces: `resolveSkillsDestination(value, { cwd, homeDir, pathApi }) -> absolute parent-plus-quorum path`
- Produces: `groupCustomDestination(destination) -> one generic-payload destination group`.

- [ ] **Step 1: Extend target metadata tests first**

```js
test("declares conservative tool detection signals", () => {
  assert.deepEqual(getTarget("codex").commands, ["codex"]);
  assert.deepEqual(getTarget("antigravity").commands, ["agy-ide", "agy"]);
  assert.deepEqual(getTarget("vscode").commands, ["copilot"]);
  assert.equal(getTarget("vscode").commands.includes("code"), false);
});
```

Also assert the exact macOS application paths and Copilot extension roots from the specification.

- [ ] **Step 2: Run target tests and verify failure**

Run: `node --test tests/targets.test.mjs`

Expected: FAIL because detection metadata is absent.

- [ ] **Step 3: Add frozen detection metadata and custom grouping**

Add `commands`, `macApplications`, and `extensionMarkers` to the five frozen target records. Export `groupCustomDestination(destination)` with `targetIds: ["custom"]`, `labels: ["Custom"]`, and `includeOpenAI: false`.

- [ ] **Step 4: Write deterministic discovery tests**

```js
test("detects commands without executing them and honors PATHEXT", async () => {
  const existing = new Set(["c:\\tools\\codex.cmd"]);
  const results = await detectTools({
    platform: "win32",
    pathApi: path.win32,
    homeDir: "C:\\Users\\giuseppe",
    env: { PATH: "C:\\Tools", PATHEXT: ".EXE;.CMD" },
    pathExists: async (candidate) => existing.has(candidate.toLowerCase()),
  });
  assert.deepEqual(results, [{ targetId: "codex", evidence: "command: codex" }]);
});

test("does not detect VS Code without Copilot", async () => {
  const existing = new Set(["/Applications/Visual Studio Code.app"]);
  const results = await detectTools({
    platform: "darwin",
    pathApi: path.posix,
    homeDir: "/Users/giuseppe",
    env: { PATH: "" },
    pathExists: async (candidate) => existing.has(candidate),
  });
  assert.equal(results.some(({ targetId }) => targetId === "vscode"), false);
});

test("resolves a parent skills directory and appends quorum", () => {
  assert.equal(
    resolveSkillsDestination("~/skills", {
      cwd: "/work",
      homeDir: "/home/giuseppe",
      pathApi: path.posix,
    }),
    path.resolve("/home/giuseppe/skills/quorum"),
  );
  const context = { cwd: "/work", homeDir: "/home/giuseppe", pathApi: path.posix };
  assert.throws(() => resolveSkillsDestination("/", context), /filesystem root/);
  assert.throws(() => resolveSkillsDestination("~other/skills", context), /unsupported home expansion/);
});
```

Add managed, shared, foreign, legacy, inaccessible-marker, application, Cursor, Claude, Antigravity, and Copilot-extension cases with injected filesystem probes.

- [ ] **Step 5: Run discovery tests and verify import failure**

Run: `node --test tests/detection.test.mjs`

Expected: FAIL because `installer/detection.mjs` does not exist.

- [ ] **Step 6: Implement discovery without executing tools**

Resolve executables by splitting `PATH` with the selected platform delimiter and checking exact candidates. On Windows, append each normalized `PATHEXT` entry. Check only the target registry's exact application and extension locations. Return one result per target using the first signal in priority order.

Inspect current destinations through `inspectQuorumPath`. Keep managed, legacy, and foreign results separate. Treat a recognized legacy path only as Codex evidence.

- [ ] **Step 7: Run target and discovery tests**

Run: `node --test tests/targets.test.mjs tests/detection.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit discovery**

```bash
git add installer/targets.mjs installer/detection.mjs tests/targets.test.mjs tests/detection.test.mjs
git commit -m "feat(installer): discover existing skills and tools"
```

---

### Task 3: CLI options, routing, and custom-path UX

**Files:**
- Modify: `installer/install.mjs`
- Modify: `tests/install.test.mjs`

**Interfaces:**
- Consumes: discovery functions from Task 2.
- Produces: `parseArguments(argv)` with `operation`, `skillsDir`, `version`, and existing fields.
- Produces: `resolveRunPlan(options, context) -> { operation, groups, targetIds, evidence, legacy, foreign }`.
- Produces: `promptForSkillsDirectory({ input, output }) -> string | null`.

- [ ] **Step 1: Write failing parser and fast-path tests**

```js
test("parses update aliases, uninstall, skills-dir, and version", () => {
  assert.equal(parseArguments(["--update"]).operation, "update");
  assert.equal(parseArguments(["--upgrade"]).operation, "update");
  assert.equal(parseArguments(["--uninstall"]).operation, "uninstall");
  assert.equal(parseArguments(["--skills-dir", "./skills"]).skillsDir, "./skills");
  assert.equal(parseArguments(["--version"]).version, true);
});

test("version exits without banner or destination access", async () => {
  const output = createSink();
  assert.equal(await main({ argv: ["--version"], sourceRoot, output }), 0);
  assert.equal(output.text(), "quorum-skill 0.1.59\n");
});
```

Add exact conflict tests for update plus upgrade, uninstall plus update, `--skills-dir` plus target or scope options, and help/version combined with any option.

- [ ] **Step 2: Run parser tests and verify failure**

Run: `node --test tests/install.test.mjs --test-name-pattern='parses update|version exits|rejects conflicting'`

Expected: FAIL on missing options and behavior.

- [ ] **Step 3: Extend parsing and help text**

Represent operations as `"install"`, `"update"`, or `"uninstall"`; map both update spellings to `"update"`. Validate terminal modes and conflicts after parsing. Read only `VERSION` for `--version`, before full payload validation and banner output.

- [ ] **Step 4: Write failing routing tests with injected discovery**

Cover the routing table exactly:

```js
test("no-target update chooses managed installations only", async () => {
  const options = parseArguments(["--update"]);
  const plan = await resolveRunPlan(options, {
    scope: "user",
    homeDir: "/home/giuseppe",
    projectRoot: null,
    discoverInstallations: async () => ({
      managed: [{ targetId: "codex" }],
      legacy: [],
      foreign: [],
    }),
    detectTools: async () => { throw new Error("tool detection must not run"); },
  });
  assert.equal(plan.operation, "update");
  assert.deepEqual(plan.targetIds, ["codex"]);
});

test("no-target update falls back to installing detected tools", async () => {
  const options = parseArguments(["--update"]);
  const plan = await resolveRunPlan(options, {
    scope: "user",
    homeDir: "/home/giuseppe",
    projectRoot: null,
    discoverInstallations: async () => ({ managed: [], legacy: [], foreign: [] }),
    detectTools: async () => [
      { targetId: "claude", evidence: "command: claude" },
      { targetId: "cursor", evidence: "command: cursor-agent" },
    ],
  });
  assert.equal(plan.operation, "install");
  assert.deepEqual(plan.targetIds, ["claude", "cursor"]);
});

test("explicit missing update target remains absent", async () => {
  const options = parseArguments(["--update", "--targets", "codex"]);
  const plan = await resolveRunPlan(options, {
    scope: "user",
    homeDir: "/home/giuseppe",
    projectRoot: null,
  });
  assert.equal(plan.operation, "update");
  assert.deepEqual(plan.targetIds, ["codex"]);
  assert.equal(plan.allowMissingInstall, false);
});
```

Also cover normal selector preservation, detected-tool auto-install without selector, legacy-only Codex migration to the current destination, custom prompt, non-TTY guidance, and `--skills-dir` precedence.

- [ ] **Step 5: Implement routing and custom prompting**

Keep routing pure where possible. Inject `discoverInstallations`, `detectTools`, `runSelector`, and the custom prompt into `resolveRunPlan` tests. Return operation and groups rather than mutating destinations during resolution.

Use `node:readline/promises` for the custom prompt. Return `null` on empty input or EOF so `main` returns 130. Do not invoke the selector when automatic tool detection or a custom-path prompt applies.

- [ ] **Step 6: Run focused installer tests**

Run: `node --test tests/install.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit CLI routing**

```bash
git add installer/install.mjs tests/install.test.mjs
git commit -m "feat(installer): add maintenance routing and custom paths"
```

---

### Task 4: Version-aware install and update policy

**Files:**
- Modify: `installer/install.mjs`
- Modify: `tests/install.test.mjs`
- Modify: `tests/version-policy.test.mjs`

**Interfaces:**
- Consumes: `inspectQuorumPath`, `parseSemanticVersion`, and `compareSemanticVersions`.
- Produces: `inspectDestination(group, options) -> { kind, identity, installedVersion, sourceVersion, contentMatches }`.
- Produces: `classifyDestination(snapshot, operation) -> { action, status?, reason?, requiresConfirmation }`.
- Extends: `installDestination(group, options)` with `operation` and state revalidation.

- [ ] **Step 1: Write failing policy tests**

```js
test("classifies update states without allowing downgrade or foreign replacement", () => {
  const base = { sourceVersion: "0.1.59", recognized: true, kind: "directory" };
  assert.equal(classifyDestination({ ...base, installedVersion: "0.1.58" }, "update").action, "update");
  assert.equal(classifyDestination({ ...base, installedVersion: "0.1.59", contentMatches: true }, "update").status, "skipped");
  assert.equal(classifyDestination({ ...base, installedVersion: "0.2.0" }, "update").status, "refused");
  assert.equal(classifyDestination({ ...base, recognized: false }, "install").status, "refused");
  assert.equal(classifyDestination({ ...base, kind: "symlink" }, "update").status, "refused");
  assert.equal(classifyDestination({ ...base, kind: "missing" }, "update").reason, "not installed");
});
```

Add tests for recognized unknown version, current modified content, `--yes`, and normal-install missing behavior.

- [ ] **Step 2: Run policy tests and verify failure**

Run: `node --test tests/version-policy.test.mjs tests/install.test.mjs`

Expected: FAIL because destination classification is absent.

- [ ] **Step 3: Implement destination inspection and pure classification**

Read installed `VERSION` only after identity succeeds. Use exact payload file and byte comparison to determine current/modified content. Return `refused` before confirmation for newer, foreign, or symlink states. Return `skipped` with `not installed` for an explicit update of a missing path.

- [ ] **Step 4: Revalidate immediately before mutation**

After confirmation, inspect the destination again and compare its kind, recognition, version text, and exact content result with the planned snapshot. Return `refused: destination changed` on any difference. Only then create the staging directory or rename the destination.

- [ ] **Step 5: Update result formatting**

Print source and installed versions for updates and implement `PLAN`, `INSTALLED`, `UPDATED`, `SKIPPED`, `REFUSED`, and `FAILED` with explicit reasons. Keep backup paths on successful updates.

- [ ] **Step 6: Run installer and version-policy tests**

Run: `node --test tests/version-policy.test.mjs tests/install.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit update safety**

```bash
git add installer/install.mjs tests/install.test.mjs tests/version-policy.test.mjs
git commit -m "feat(installer): enforce version-aware update safety"
```

---

### Task 5: Permanent guarded uninstall

**Files:**
- Create: `installer/uninstall.mjs`
- Create: `tests/uninstall.test.mjs`
- Modify: `installer/install.mjs`
- Modify: `tests/install.test.mjs`

**Interfaces:**
- Consumes: exact destination groups and `inspectQuorumPath`.
- Produces: `uninstallDestination(group, options) -> removal result`.
- Produces: `uninstallSelected(groups, options) -> removal results[]`.
- Produces: `defaultConfirmUninstall(groups, { input, output }) -> boolean`.

- [ ] **Step 1: Write failing removal tests**

```js
test("permanently removes only a recognized quorum directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "quorum-uninstall-"));
  const destination = path.join(root, "skills", "quorum");
  const sibling = path.join(root, "skills", "other");
  await mkdir(destination, { recursive: true });
  await mkdir(sibling);
  await writeFile(path.join(destination, "SKILL.md"), "---\nname: quorum\n---\n");
  const group = { destination, labels: ["Custom"] };
  const result = await uninstallDestination(group, { yes: true, cwd: root });
  assert.equal(result.status, "removed");
  await assert.rejects(access(group.destination), /ENOENT/);
  await access(path.dirname(group.destination));
  await access(sibling);
});

test("unlinks a recognized symlink without deleting its target", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "quorum-uninstall-link-"));
  const realTarget = path.join(root, "real", "quorum");
  const destination = path.join(root, "skills", "quorum");
  await mkdir(realTarget, { recursive: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(path.join(realTarget, "SKILL.md"), "---\nname: quorum\n---\n");
  await symlink(realTarget, destination);
  const linkGroup = { destination, labels: ["Custom"] };
  const result = await uninstallDestination(linkGroup, { yes: true, cwd: root });
  assert.equal(result.status, "removed");
  await assert.rejects(lstat(linkGroup.destination), /ENOENT/);
  await access(path.join(realTarget, "SKILL.md"));
});
```

Add foreign content, missing path, current-working-directory containment, changed-after-confirmation, dry-run, confirmation decline, parent/sibling preservation, backup preservation, and partial-failure cases.

- [ ] **Step 2: Run uninstall tests and verify import failure**

Run: `node --test tests/uninstall.test.mjs`

Expected: FAIL because `installer/uninstall.mjs` does not exist.

- [ ] **Step 3: Implement exact removal**

Build the full deduplicated plan before prompting. Refuse unrecognized expected paths. In dry-run, return `planned` without prompting. For directories, reject when the normalized real current working directory is equal to or below the normalized real destination. Reinspect identity and type immediately before `rm(destination, { recursive: true })`. For symlinks, call `unlink(destination)` and never `rm` the resolved target.

- [ ] **Step 4: Integrate uninstall routing**

At user scope, add the recognized legacy Codex path whenever Codex is selected by discovery, `--targets codex`, or `--all`. Do not add it at project scope. `--skills-dir` removes only its exact custom destination. A no-target uninstall with no recognized or foreign expected path exits successfully with the not-installed message.

- [ ] **Step 5: Run uninstall and main-flow tests**

Run: `node --test tests/uninstall.test.mjs tests/install.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit uninstall**

```bash
git add installer/uninstall.mjs installer/install.mjs tests/uninstall.test.mjs tests/install.test.mjs
git commit -m "feat(installer): add guarded permanent uninstall"
```

---

### Task 6: Version bump, package contract, integration tests, and documentation

**Files:**
- Modify: `VERSION`
- Modify: `package.json`
- Modify: `SKILL.md`
- Modify: `scripts/package-contract.mjs`
- Modify: `tests/version.test.mjs`
- Modify: `tests/package-contract.test.mjs`
- Modify: `tests/distribution.test.mjs`
- Modify: `tests/test-install.sh`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `PUBLISHING.md`
- Modify: `ROADMAP.md`
- Modify: `docs/superpowers/specs/2026-09-07-version-update-uninstall-design.md`

**Interfaces:**
- Publishes: `installer/detection.mjs`, `installer/identity.mjs`, `installer/version.mjs`, and `installer/uninstall.mjs` in the npm tarball and release ZIP.
- Documents: exact default routing, source-package update semantics, explicit custom paths, downgrade and foreign-content policy, and permanent-uninstall warning.

- [ ] **Step 1: Update version fixtures and package expectations first**

Change exact assertions from `0.1.58` to `0.1.59`. Add all four new runtime modules to `package.json.files` and `EXPECTED_PACKAGE_FILES`.

- [ ] **Step 2: Expand packed-executable integration coverage**

From the generated tarball, verify:

```bash
quorum_smoke_root=$(mktemp -d "${TMPDIR:-/tmp}/quorum-0.1.59-smoke.XXXXXX")
quorum-skill --version
quorum-skill --targets codex --scope project --project-root "$quorum_smoke_root" --dry-run
quorum-skill --update --targets codex --scope project --project-root "$quorum_smoke_root" --dry-run
quorum-skill --uninstall --targets codex --scope project --project-root "$quorum_smoke_root" --dry-run
```

Assert exact version output, no filesystem write in dry-run, and availability of every new packaged module.

- [ ] **Step 3: Update shell integration tests**

Exercise explicit installation, no-target discovery with a controlled temporary `PATH`, update with a preserved backup, downgrade refusal fixture, custom skills directory, permanent uninstall, parent preservation, and the PowerShell dry-run smoke test when available.

- [ ] **Step 4: Bump all source declarations to 0.1.59**

Set `VERSION`, `package.json.version`, and `SKILL.md` metadata to `0.1.59`. The banner continues to use the validated source version.

- [ ] **Step 5: Rewrite README maintenance documentation**

Document:

- `npx quorum-skill --version`
- Automatic managed-installation and supported-tool discovery
- Why VS Code requires Copilot-specific evidence
- `--update` and `--upgrade` as aliases for the running package
- Explicit update targets remaining absent when not installed
- `--skills-dir` parent-directory semantics
- Version states, downgrade refusal, foreign-content refusal, and backups
- Permanent `--uninstall`, `--dry-run`, `--yes`, legacy behavior, and exact safety limits
- Updated option table and examples for user and project scope

- [ ] **Step 6: Update release and roadmap documentation**

Move the 0.1.59 entries from `CHANGELOG.md` Unreleased into a dated `0.1.59` section and add comparison links. Mark the design status approved and the roadmap implementation complete only after tests pass. Update `PUBLISHING.md` with the exact trusted-publish, provenance, tag, and release verification commands for 0.1.59.

- [ ] **Step 7: Run the complete local gate**

Run:

```bash
npm test
TZ=UTC npm run dist
git diff --check
```

Expected: all Node tests, shell integration tests, exact packlist checks, distribution checks, and workflow checks pass. `dist/` contains `quorum-skill-0.1.59.tgz`, `quorum-skill-0.1.59.zip`, and `SHA256SUMS`.

- [ ] **Step 8: Run local tarball smoke tests outside the repository**

Use a temporary directory and isolated npm cache. Verify `--version`, help, install dry-run, update dry-run, uninstall dry-run, and checksum validation against the generated files.

- [ ] **Step 9: Review the complete diff and commit the release candidate**

```bash
git status --short
git diff --check
git diff --stat
git add VERSION package.json SKILL.md installer scripts tests README.md CHANGELOG.md PUBLISHING.md ROADMAP.md docs/superpowers
git commit -m "feat(installer): release maintenance workflows"
```

---

### Task 7: Push, trusted publish, provenance, tag, and GitHub release

**Files:**
- Read: `.github/workflows/publish.yml`
- Read: `PUBLISHING.md`
- Generated locally: `dist/quorum-skill-0.1.59.tgz`, `dist/quorum-skill-0.1.59.zip`, `dist/SHA256SUMS`

**Interfaces:**
- Consumes: verified `main` release commit and npm trusted-publisher relationship.
- Produces: pushed `main`, npm `quorum-skill@0.1.59`, annotated `v0.1.59`, and public GitHub release with the workflow's exact artifacts.

- [ ] **Step 1: Verify local and remote prerequisites without exposing credentials**

Run:

```bash
git status --short --branch
git fetch origin
git rev-list --left-right --count origin/main...main
gh auth status
npm view quorum-skill@0.1.58 version
npm view quorum-skill@0.1.59 version
npx -y npm@^11.15.0 trust list quorum-skill --json
```

Expected: clean release worktree, local main based on current origin/main, GitHub authentication active, 0.1.58 present, 0.1.59 absent, and trust bound to `GTuritto/quorum` plus `publish.yml` with direct publishing enabled.

- [ ] **Step 2: Push the verified release commit**

```bash
git push origin main
```

- [ ] **Step 3: Dispatch and watch trusted publishing**

```bash
gh workflow run publish.yml --ref main -f version=0.1.59
quorum_run_id=$(gh run list --workflow publish.yml --branch main --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$quorum_run_id" --exit-status
```

Expected: tests and distribution build pass, the artifact uploads before publish, and npm trusted publishing succeeds without a token secret.

- [ ] **Step 4: Download the workflow artifact and compare it with the local build**

```bash
quorum_artifact_dir=$(mktemp -d "${TMPDIR:-/tmp}/quorum-0.1.59-artifact.XXXXXX")
gh run download "$quorum_run_id" --name quorum-skill-0.1.59 --dir "$quorum_artifact_dir"
(cd "$quorum_artifact_dir" && shasum -a 256 -c SHA256SUMS)
cmp dist/quorum-skill-0.1.59.tgz "$quorum_artifact_dir/quorum-skill-0.1.59.tgz"
cmp dist/quorum-skill-0.1.59.zip "$quorum_artifact_dir/quorum-skill-0.1.59.zip"
```

Expected: workflow and local release artifacts match byte for byte.

- [ ] **Step 5: Verify npm metadata, execution, and provenance**

```bash
npm view quorum-skill@0.1.59 version dist.integrity dist.tarball dist.attestations --json
quorum_smoke_dir=$(mktemp -d "${TMPDIR:-/tmp}/quorum-0.1.59-smoke.XXXXXX")
(cd "$quorum_smoke_dir" && npx -y quorum-skill@0.1.59 --version)
```

Expected: version 0.1.59, a registry integrity value, npm attestation metadata linked to the GitHub workflow, and exact CLI output `quorum-skill 0.1.59`.

- [ ] **Step 6: Create and push the annotated tag**

```bash
git tag -a v0.1.59 -m "Quorum 0.1.59"
git push origin v0.1.59
```

- [ ] **Step 7: Create a draft GitHub release from the workflow artifacts**

```bash
quorum_release_notes=$(mktemp "${TMPDIR:-/tmp}/quorum-0.1.59-notes.XXXXXX")
sed -n '/^## \[0.1.59\]/,/^## \[/p' CHANGELOG.md | sed '$d' > "$quorum_release_notes"
gh release create v0.1.59 \
  --draft \
  --title "Quorum 0.1.59" \
  --notes-file "$quorum_release_notes" \
  "$quorum_artifact_dir/quorum-skill-0.1.59.tgz" \
  "$quorum_artifact_dir/quorum-skill-0.1.59.zip" \
  "$quorum_artifact_dir/SHA256SUMS"
```

Use only the 0.1.59 changelog entry for release notes.

- [ ] **Step 8: Verify remote assets before publishing the release**

```bash
quorum_release_verify_dir=$(mktemp -d "${TMPDIR:-/tmp}/quorum-0.1.59-release.XXXXXX")
gh release download v0.1.59 --dir "$quorum_release_verify_dir"
(cd "$quorum_release_verify_dir" && shasum -a 256 -c SHA256SUMS)
cmp "$quorum_artifact_dir/quorum-skill-0.1.59.tgz" "$quorum_release_verify_dir/quorum-skill-0.1.59.tgz"
cmp "$quorum_artifact_dir/quorum-skill-0.1.59.zip" "$quorum_release_verify_dir/quorum-skill-0.1.59.zip"
test "$(git rev-list -n 1 v0.1.59)" = "$(git rev-parse HEAD)"
```

- [ ] **Step 9: Publish and audit the GitHub release**

```bash
gh release edit v0.1.59 --draft=false
gh release view v0.1.59 --json url,isDraft,isPrerelease,tagName,targetCommitish,assets
git ls-remote --tags origin refs/tags/v0.1.59
```

Expected: public non-prerelease release, three verified assets, annotated tag at the release commit, and working npm and GitHub URLs.

- [ ] **Step 10: Perform the completion audit**

Map every specification success criterion to a passing test, package artifact, npm registry field, provenance attestation, Git commit, pushed ref, tag, or GitHub release field. Leave the goal active if any item lacks authoritative evidence.
