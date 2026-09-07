# Quorum Version, Update, and Uninstall Design

Date: 2026-09-07
Version: 0.1.59
Status: Approved for implementation

## Objective

Make Quorum easier to inspect and maintain after installation. Version 0.1.59
adds version reporting, automatic installation discovery, update and upgrade
commands, tool-aware first installation, explicit custom destinations, and
permanent uninstall.

The installer remains local and dependency-free. npm or the user's download
tool retrieves a Quorum release; the installer performs no network requests.

## Scope

Version 0.1.59 adds:

- `--version` for source-package version reporting.
- `--update` and `--upgrade` as exact aliases.
- Automatic discovery of existing Quorum installations.
- Conservative detection of installed supported tools.
- Automatic installation for all detected tools when no Quorum installation
  exists and the user did not select targets.
- `--skills-dir PATH` for an explicit parent skills directory.
- `--uninstall` for permanent removal of recognized Quorum installations.
- Version-aware replacement and downgrade prevention.
- Deterministic tests for discovery, version policy, custom paths, and removal.

This release does not add network-based update checks, persistent installer
configuration, package self-modification, or Quorum decision memory. npm
selects the source package version before the installer starts.

`--update` and `--upgrade` mean "apply the running Quorum package to eligible
existing installations." For example, `npx quorum-skill@0.1.59 --update`
applies 0.1.59. The installer neither queries npm nor downloads another
version.

## Chosen approach

Extend the existing installer with focused discovery, identity, version, and
removal modules. Keep target paths and target metadata declarative in
`installer/targets.mjs`; add discovery in `installer/detection.mjs`, skill
recognition in `installer/identity.mjs`, version classification in
`installer/version.mjs`, and guarded removal in `installer/uninstall.mjs`.
`installer/install.mjs` remains the command-line entry point and orchestrator.

This structure keeps platform detection, semantic-version policy, destructive
removal, terminal selection, and file placement independently testable. It
also prevents the existing entry point from absorbing every new behavior.

Rejected alternatives:

- Adding all discovery and version logic directly to `install.mjs` would make
  the current parser and orchestrator harder to test and maintain.
- Creating separate install, update, and uninstall executables would duplicate
  target resolution, confirmation, dry-run, and reporting behavior.
- Treating generic configuration directories as proof that a tool exists would
  create false installations from stale or shared directories.
- Removing only known packaged files during uninstall could leave a partially
  active or broken skill.
- Moving uninstalled content to a backup would be recoverable, but the approved
  uninstall contract requires permanent removal.

## Command-line contract

Version 0.1.59 supports:

```text
--targets codex,claude,antigravity,vscode,cursor
--all
--scope user|project
--project-root PATH
--skills-dir PATH
--update
--upgrade
--uninstall
--version
--dry-run
--yes
--help
```

### Option rules

- `--update` and `--upgrade` are exact aliases. Supplying both is an error.
- `--uninstall` cannot be combined with `--update` or `--upgrade`.
- `--targets` and `--all` remain mutually exclusive.
- `--skills-dir` cannot be combined with `--targets`, `--all`, `--scope`, or
  `--project-root`.
- `--skills-dir` may be combined with `--update`, `--upgrade`, `--uninstall`,
  `--dry-run`, or `--yes`.
- `--version` is a terminal mode and must be used alone. It prints
  `quorum-skill 0.1.59` without a banner, destination scan, prompt, or write.
- `--help` is a terminal mode, must be used alone, and performs no discovery or
  write.
- Unknown options and missing option values remain errors.
- `--dry-run` performs discovery and validation but never writes or removes
  files and never asks for confirmation.
- `--yes` supplies replacement or removal confirmation. It never authorizes a
  downgrade, replacement of foreign content, or removal of an unrecognized
  directory.

### Explicit destinations take precedence

`--targets`, `--all`, and `--skills-dir` are explicit destination choices. The
installer does not replace them with automatically discovered targets.

For a normal install, an explicit missing destination receives a new
installation. For update or upgrade, an explicit missing destination is
reported as not installed and remains unchanged. Existing destinations follow
the version and content policy below. Uninstall also skips missing explicit
destinations.

## Default routing

The installer resolves actions in this order:

1. Parse and validate arguments.
2. Handle `--help` or `--version` and exit.
3. Validate the source version and payload for install and update actions.
4. Resolve `--skills-dir`, `--targets`, or `--all` when present.
5. Otherwise, discover managed and legacy Quorum installations in the resolved
   scope.
6. Apply the action-specific routing below.
7. Deduplicate shared destinations.
8. Classify every destination by installation state, version, and content.
9. Print the plan, honor dry-run, and obtain any required confirmation.
10. Execute each destination independently and print a final summary.

### Routing table

| Invocation | Relevant discovery state | Result |
| --- | --- | --- |
| No action or target options | One or more managed installations | Open the existing target selector. Selected destinations use normal install or update policy. |
| No action or target options | No managed installation | Detect supported tools and install for every detected tool without opening the selector. A recognized legacy Codex copy counts as Codex detection evidence. |
| `--update` or `--upgrade`, no targets | One or more managed installations | Update only the managed installations. |
| `--update` or `--upgrade`, no targets | No managed installation | Detect supported tools and install for every detected tool. A recognized legacy Codex copy selects the current Codex destination, not the legacy path. |
| `--update` or `--upgrade`, explicit targets | Any | Update recognized installations among the explicit targets and report missing targets as not installed. Do not install a missing explicit target. |
| Normal install or no-target update | No managed installation and no tool evidence | Prompt for a parent skills directory in an interactive terminal. |
| Normal install or no-target update, non-interactive | No managed installation and no tool evidence | Exit with guidance to use `--skills-dir`, `--targets`, or `--all`. |
| `--uninstall`, no targets | At least one recognized managed or legacy installation | Permanently remove the recognized installations in the resolved scope after confirmation. |
| `--uninstall`, no targets | Foreign content at an expected Quorum destination | Report `REFUSED`, preserve the content, and exit nonzero. |
| `--uninstall`, no targets | No recognized installation or foreign expected path | Report that Quorum is not installed and exit successfully. |

Uninstall never detects supported tools and never installs anything.
In this table, action means normal install, update or upgrade, or uninstall.
Modifiers such as `--dry-run` and `--yes` do not select an action or target.

## Scope and destinations

User scope remains the default. `--scope project` resolves the current Git root
when available, then the current directory. `--project-root PATH` selects that
project and implies project scope.

Discovery classifies paths before routing:

- A **managed installation** is a recognized Quorum skill at a current target
  destination for the resolved scope. Install and update may write it.
- A **legacy installation** is a recognized Quorum skill at
  `${CODEX_HOME:-~/.codex}/skills/quorum`. Install and update treat it as Codex
  detection evidence and report it, but never modify it.
- A **custom installation** is considered only when the user supplies its
  parent through `--skills-dir`. Version 0.1.59 does not search arbitrary
  paths.

When a recognized legacy copy is the only Quorum installation, automatic tool
detection selects Codex's current destination, `~/.agents/skills/quorum`. The
installer leaves the legacy copy in place and reports how to remove it with
`--uninstall --targets codex` after the current installation is verified.

When several targets map to the same path, the installer performs one action
and reports every consumer. Shared destinations never cause duplicate writes,
prompts, or removals.

## Tool detection

`installer/detection.mjs` detects supported tools through local evidence. It
does not execute tools, inspect running processes, or access the network.

Detection evaluates signals in this order:

1. An existing managed Quorum installation at a current target destination.
2. A recognized legacy Codex installation, as Codex evidence only.
3. A target-specific executable on `PATH`.
4. A known target-specific application or integration installation marker.

The target registry declares this detection matrix:

| Target | Executable evidence | Application or integration evidence | Explicit exclusion |
| --- | --- | --- | --- |
| Codex | `codex` | A standard Codex desktop application installation | A generic `.agents` or `.codex` directory |
| Claude Code | `claude` | A standard Claude desktop application that includes Claude Code | A generic `.claude` directory |
| Antigravity | `agy-ide` or `agy` | A standard Antigravity IDE installation | A generic `.gemini` directory |
| VS Code with GitHub Copilot | `copilot` | An installed `github.copilot-chat` extension in a standard local VS Code extension directory | `code` or a VS Code application alone |
| Cursor | `cursor-agent` | A standard Cursor application installation | A generic `.cursor` directory |

The executable names follow the vendors' current documented entry points:
[Codex CLI](https://help.openai.com/en/articles/11096431),
[Claude Code](https://code.claude.com/docs),
[Antigravity IDE](https://codelabs.developers.google.com/getting-started-agy-ide),
[GitHub Copilot CLI](https://docs.github.com/en/copilot/get-started/cli-quickstart),
and [Cursor CLI](https://docs.cursor.com/en/cli/overview). GitHub documents
Agent Skills support for Copilot CLI and agent mode in VS Code, so the detector
requires Copilot-specific evidence instead of treating VS Code alone as a
supported target.

Standard application and extension locations are explicit per-platform arrays
in the target registry. Detection checks those exact locations; it never scans
the whole filesystem or guesses from a directory name. The detector supports
Windows `PATHEXT` when resolving commands.

The initial application allowlist is deliberately narrow:

| Target | macOS markers | Windows and Linux markers |
| --- | --- | --- |
| Codex | `/Applications/Codex.app` or `~/Applications/Codex.app` | Executable evidence only |
| Claude Code | `/Applications/Claude.app` or `~/Applications/Claude.app` | Executable evidence only |
| Antigravity | `/Applications/Antigravity IDE.app` or `~/Applications/Antigravity IDE.app` | Executable evidence only |
| VS Code with GitHub Copilot | `github.copilot-chat-*` under `~/.vscode/extensions` or `~/.vscode-insiders/extensions` | The same paths under the Linux home directory or `%USERPROFILE%\.vscode\extensions` and `%USERPROFILE%\.vscode-insiders\extensions` on Windows |
| Cursor | `/Applications/Cursor.app` or `~/Applications/Cursor.app` | Executable evidence only |

An application marker must be a real application bundle at the exact path, not
an alias or similarly named directory. Version 0.1.59 does not guess unverified
Windows or Linux application paths. A missed detection falls back to the custom
path prompt; a false detection would write an unwanted installation.

Generic, shared, or stale configuration directories do not prove that a
supported tool exists. Avoiding a false installation takes priority over
detecting every possible installation.

Each result records its evidence so the CLI can report messages such as
`Detected Codex (command: codex)`. Permission errors from optional probes become
warnings; they do not stop other detection checks.

Filesystem, environment, platform, home-directory, and `PATH` operations are
injectable so tests do not depend on the developer's machine.

## Custom skills directory

`--skills-dir PATH` and the interactive fallback accept a parent skills
directory. Quorum appends `quorum`, producing `<PATH>/quorum`.

Path rules:

- Expand `~` or `~/...` from the resolved user home. Reject `~other-user`
  expansion rather than guessing another account's home directory.
- Resolve relative paths from the current working directory.
- Normalize the result before validation or display.
- Reject an empty path or a filesystem root.
- Create a missing parent during a confirmed install or update when possible.
- Install the generic portable payload and omit Codex-specific
  `agents/openai.yaml`, because the runtime is unknown.
- Require the same `--skills-dir` value for later discovery, update, or
  uninstall. Version 0.1.59 stores no custom-path registry.
- Treat `--update --skills-dir PATH` as an explicit update. If `<PATH>/quorum`
  is missing, report it as not installed and do not prompt for another path.

If automatic discovery finds no installations or supported tools, an
interactive run prompts:

```text
No supported tools detected.
Enter a parent skills directory, or press Ctrl+C to cancel:
```

An empty response, end-of-input, or cancellation exits with status 130 and
writes nothing. A non-interactive run fails before any write and explains the
explicit path and target options.

## Version and content policy

The package-local `VERSION` file remains the installer's version source of
truth. The early `--version` path reads and validates only that file; it does
not validate the payload or inspect destinations. `installer/version.mjs`
implements strict semantic-version parsing and comparison without duplicating
the source version in another constant. Repository tests require `VERSION`,
`package.json`, `SKILL.md`, and the banner to agree.

The installer recognizes a Quorum directory when its final path component is
`quorum` and its `SKILL.md` frontmatter declares `name: quorum`. A small parser
reads only the initial YAML frontmatter block and the scalar `name` field. It
accepts `quorum`, `"quorum"`, or `'quorum'` as scalar forms and does not use
substring matching across the whole file.

An existing destination has one of these states:

| State | Policy |
| --- | --- |
| Missing | Install during normal installation or the no-target update fallback after tool detection; explicit update targets remain missing. |
| Recognized, older | Eligible for update; replacement still requires confirmation unless `--yes` is present. |
| Recognized, current and identical | Skip as already current. |
| Recognized, current and modified | Require confirmation before replacement. |
| Recognized, newer | Refuse to downgrade, including with `--yes`. |
| Recognized, missing or invalid version | Classify as unknown and require confirmation before replacement. |
| Foreign directory, file, or other node | Refuse replacement, including with `--yes`; tell the user to inspect or relocate it. |
| Symbolic link | Refuse install and update so the installer does not silently replace a user-managed link. |

All replacement paths retain the existing staged installation flow:

1. Copy the new payload to a sibling staging directory.
2. Rename the current destination to a timestamped sibling backup.
3. Rename the staged payload into the destination.
4. Restore the backup if final placement fails.

Backups remain untouched. A pinned older npm package therefore cannot
downgrade a newer installation through normal install, `--update`, or
`--upgrade`.

The installer records the destination state used to build the plan and checks
it again immediately before mutation. If the path type, identity, version, or
content changes after planning or confirmation, that destination fails safely
and remains untouched.

## Reporting contract

Before a filesystem action, the CLI prints the resolved scope, selected
targets, detection evidence when used, and the deduplicated destinations.
Install and update also print the running source version. Each destination ends
with one of these human-readable statuses:

- `PLAN` with the proposed install, update, or removal action.
- `INSTALLED` for a new installation.
- `UPDATED` with the backup path.
- `REMOVED` for permanent uninstall.
- `SKIPPED` with a reason such as `already current`, `not installed`, or
  `missing`.
- `REFUSED` with a safety reason such as `newer version`, `foreign content`,
  `symbolic link`, or `destination changed`.
- `FAILED` with the filesystem or validation error.

When available, update output shows both installed and source versions. Missing
or invalid installed versions display as `unknown`; the CLI never labels the
source version as an online or latest version.

## Permanent uninstall

`--uninstall` removes recognized Quorum installations permanently. It creates
no backup and never removes a parent skills directory.

Before removal, the installer prints every exact destination and the targets
that use it. Unless `--dry-run` or `--yes` is present, it requests one
confirmation for the complete deduplicated plan. A non-interactive uninstall
without either flag fails before removing anything.

A real directory is eligible only when:

- Its final path component is `quorum`.
- It contains a readable `SKILL.md`.
- The `SKILL.md` frontmatter declares `name: quorum`.

The version may be missing or invalid because uninstall must support damaged or
legacy Quorum copies. Identity validation remains mandatory. A symbolic link is
eligible only when its final component is `quorum` and its resolved target has
a readable `SKILL.md` whose frontmatter declares `name: quorum`. The target
directory may have a different final component because removal unlinks only the
link. There is no `--force` option in 0.1.59.

For a real directory, the installer recursively removes only that exact
`quorum` directory. For a symbolic link, it may inspect the resolved target
read-only to validate Quorum's identity, but removal unlinks only the link and
never deletes the target. Modified or additional files inside a recognized
installation are removed after confirmation.

At user scope, selecting Codex for uninstall, whether through discovery,
`--targets codex`, or `--all`, also adds a recognized legacy Codex path to the
removal plan. Project-scope uninstall never reaches into the user legacy path.
Old timestamped update backups do not match an active destination and remain
untouched.

The installer refuses to remove a directory that contains the process's current
working directory. It tells the user to change directories and rerun the
command. Before each removal, it repeats the path-type and identity checks. A
path changed after planning or confirmation is refused and remains untouched.

Removal statuses are `REMOVED`, `SKIPPED`, `REFUSED`, and `FAILED`. A path that
exists at an expected destination but fails Quorum identity checks is reported
as `REFUSED`, not ignored. One failure does not prevent independent
destinations from being attempted, but any refusal or failure produces a
nonzero final exit status.

## Components

### `installer/targets.mjs`

Keep target identifiers, display names, user and project destinations, shared
destination behavior, payload variants, legacy paths, and declarative
detection metadata in one registry.

### `installer/detection.mjs`

Discover recognized Quorum installations and supported tools. Return structured
results containing target ID, destination, evidence, scope, and legacy status.
Accept injected environment and filesystem probes for tests.

### `installer/identity.mjs`

Parse the initial `SKILL.md` frontmatter block and decide whether an exact path
contains Quorum. Share this identity check across discovery, replacement
policy, and uninstall.

### `installer/version.mjs`

Parse and compare semantic versions and return policy classifications. This
module does not read destinations, duplicate the source version, or modify
files.

### `installer/uninstall.mjs`

Validate Quorum identity, create a deduplicated removal plan, and remove exact
directories or links. This module never resolves broad parent paths.

### `installer/install.mjs`

Parse arguments and orchestrate routing, prompts, dry runs, confirmations,
installation, update, uninstall, and reporting. Reuse the current staged copy,
backup, atomic placement, rollback, and per-destination isolation.

### `installer/selector.mjs`

Keep the existing keyboard and mouse selector unchanged. Invoke it only for the
approved no-action flow when existing Quorum installations are present and no
explicit targets were supplied.

## Error handling

- Invalid source metadata or payload stops install and update before writing.
- Version reporting does not depend on destination access or source-payload
  validation.
- Optional detection failures produce warnings and allow other probes to run.
- Invalid custom paths fail before directory creation.
- A required prompt in a non-interactive environment fails before any change.
- A newer installation is refused rather than downgraded.
- Foreign content and user-managed symbolic links are refused rather than
  replaced.
- An unrecognized uninstall destination is refused rather than deleted.
- A destination changed after planning or confirmation is refused rather than
  mutated.
- Destination failures are isolated and included in the final summary.
- Any failed or refused requested action returns a nonzero status.
- Cancellation restores terminal state and exits with status 130.

The command returns:

- `0` when all requested actions are installed, updated, removed, skipped, or
  successfully planned by `--dry-run`.
- `1` for invalid arguments, failed validation, required non-interactive input,
  refused actions, or destination failures.
- `130` for interactive cancellation or end-of-input at a required prompt.

## Verification

### Argument and routing tests

- Parse every new option, alias, missing value, and incompatible combination.
- Verify that `--version` prints the exact version without a banner, prompt,
  destination probe, or write.
- Verify explicit targets and `--skills-dir` take precedence over discovery.
- Verify explicit update targets that are missing remain missing and do not
  trigger tool detection or a custom-path prompt.
- Preserve the selector for existing installations in the normal no-target
  flow.
- Verify update mode selects existing installations only, then falls back to
  tool detection only when none exist.
- Verify a legacy-only Codex installation selects the current Codex destination
  while the legacy directory remains unchanged.
- Verify uninstall never falls back to tool detection.

### Detection tests

- Cover every executable and application or integration signal in the detection
  matrix on macOS, Linux, and Windows fixtures.
- Verify that VS Code or `code` without Copilot evidence does not select the VS
  Code target.
- Cover Windows `PATHEXT`, missing paths, inaccessible markers, and stale or
  generic directories.
- Discover user, project, custom, shared, and legacy destinations.
- Record deterministic evidence and deduplicate shared destinations.

### Version and installation tests

- Classify older, equal, newer, malformed, and missing versions.
- Skip identical current content and confirm modified current content.
- Confirm older and unknown replacements unless `--yes` is present.
- Refuse downgrade in normal, update, upgrade, and `--yes` flows.
- Refuse foreign content and symbolic links in normal, update, upgrade, and
  `--yes` flows.
- Recheck destination state before mutation and refuse a simulated state
  change after confirmation.
- Verify `--update` and `--upgrade` produce identical plans.
- Verify source and installed version labels plus every terminal status and
  reason.
- Verify dry-run writes nothing.
- Verify backups, atomic placement, rollback, and partial failure behavior.

### Custom-path tests

- Expand `~`, resolve relative paths, normalize paths, and append `quorum`.
- Reject empty and root paths.
- Install the generic payload without `agents/openai.yaml`.
- Prompt only when no installation or supported tool is detected.
- Produce actionable non-interactive guidance.

### Uninstall tests

- Remove recognized current, modified, damaged-version, and legacy
  installations after confirmation.
- Skip missing destinations.
- Refuse incorrectly named directories and invalid skill identities.
- Unlink symlinks without changing their targets.
- Refuse a destination that contains the current working directory.
- Refuse a path whose type or identity changes after confirmation.
- Preserve parent directories, sibling skills, and timestamped backups.
- Verify dry-run, `--yes`, non-interactive failure, deduplication, partial
  failures, status reporting, and exit codes.

### Distribution and regression tests

- Update the exact npm packlist for the new detection, identity, version, and
  uninstall modules.
- Run the full selector, target-path, package-contract, workflow, and
  distribution suites.
- Build the npm tarball and compact release archive from the same allowlist.
- Execute `--version`, install, update, dry-run, and uninstall smoke tests from
  the packed tarball in temporary directories.
- Run the PowerShell smoke test when `pwsh` is available and report a skip when
  it is unavailable.
- Use deterministic platform fixtures for Windows behavior. Record whether an
  actual Windows smoke test was performed.

Required local verification:

```sh
npm test
npm run dist
git diff --check
```

## Documentation and release changes

Update these files for 0.1.59:

- `VERSION`, `package.json`, `SKILL.md`, and the banner version.
- `README.md` with new default discovery behavior, options, examples, version
  policy, custom paths, and permanent-uninstall warnings.
- `CHANGELOG.md` with user-visible 0.1.59 behavior.
- `ROADMAP.md` to mark the 0.1.59 items as implemented while retaining the
  proposed 0.1.60 and 0.2.0 work.
- Package-contract tests and release documentation when the new CLI changes
  affect their examples or checks.

The implementation does not publish, tag, push, or create a GitHub release.
Those actions require a separate explicit release instruction after all checks
pass. Before publishing 0.1.59, verify the npm trusted-publisher configuration
and provenance workflow live.

## Success criteria

- `npx quorum-skill --version` reports `quorum-skill 0.1.59` and exits without
  invoking installation behavior or reading any destination.
- A no-target install distinguishes managed and legacy Quorum installations
  before detecting supported tools.
- A new user with supported tools receives Quorum for every detected tool
  without seeing the selector.
- VS Code is selected automatically only when GitHub Copilot evidence exists.
- A user with no detected tool can supply a parent skills directory
  interactively or through `--skills-dir`.
- Update and upgrade act as aliases, update existing installations by default,
  leave explicitly selected missing targets absent, and never downgrade a newer
  installation.
- Install and update retain confirmation, dry-run, backup, atomic placement,
  rollback, and partial-failure guarantees.
- Install and update refuse foreign content, user-managed symbolic links, and
  destinations that change after confirmation.
- Install and update never modify the legacy Codex path.
- Uninstall permanently removes only recognized Quorum directories or links,
  preserves every parent and sibling, and requires confirmation unless
  `--dry-run` or `--yes` is present.
- The installer remains dependency-free and performs no network requests.
- Package metadata, installed metadata, CLI output, documentation, and release
  artifacts agree on version 0.1.59.
