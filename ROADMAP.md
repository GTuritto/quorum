# Quorum Roadmap

This roadmap records intended future work. Items are not committed release
dates or approved implementation specifications.

## Release candidate: 0.1.59

The approved design is implemented and verified locally:
[`docs/superpowers/specs/2026-09-07-version-update-uninstall-design.md`](docs/superpowers/specs/2026-09-07-version-update-uninstall-design.md).
Trusted npm publication and the GitHub release remain pending.

### Version reporting

- Add `npx quorum-skill --version`.
- Print the package version and exit without opening the selector, inspecting
  destinations, or writing files.
- Keep `VERSION`, `package.json`, and `SKILL.md` version metadata aligned.

### Update and upgrade support

- Add `--update` and `--upgrade` as aliases for applying the running package to
  existing Quorum installations.
- Discover managed installations before detecting supported tools.
- When no installation exists and no target was supplied, install for every
  conservatively detected supported tool without opening the selector.
- Require Copilot-specific evidence before automatically selecting the VS Code
  target.
- Accept an explicit parent skills directory through `--skills-dir` and append
  `quorum`.
- Preserve the installer's target selection, dry-run, confirmation, backup,
  atomic replacement, and partial-failure guarantees.
- Report installed and source-package versions before changing files.
- Prevent downgrades and refuse foreign destination content even with `--yes`.
- Keep legacy Codex installations read-only during install and update.

### Permanent uninstall

- Add `--uninstall` for recognized current, custom, and legacy Quorum
  installations.
- Require confirmation unless `--dry-run` or `--yes` is present.
- Remove only the exact Quorum directory or link. Preserve parent directories,
  sibling skills, and update backups.
- Refuse foreign content, current-working-directory removal, symlink-target
  deletion, and destinations that change after confirmation.

### Deferred installer maintenance

- Consider a read-only `--status` command that lists installed targets,
  versions, legacy copies, and modified content.
- Consider `--json` output after the human-readable status model stabilizes.
- Consider explicit backup listing, restoration, and cleanup commands. Never
  remove update backups implicitly.

## Possible follow-up release: 0.1.60

### Cost-aware deliberation

- Make direct execution the stronger default for routine coding, status checks,
  known-cause fixes, and implementation of already-approved decisions.
- Use the mini tier for meaningfully ambiguous decisions that benefit from
  structured challenge without isolated workers.
- Reserve the full tier for explicit requests and clearly high-stakes,
  consequential, or difficult-to-reverse decisions.
- Return to direct execution after a decision is made instead of applying a new
  council run to every implementation turn.
- Avoid repeating deliberation when the request and material assumptions have
  not changed.

### Cost visibility and controls

- Show a concise execution receipt, such as `Quorum: mini, 0 workers`, stating
  the selected tier and actual worker usage.
- Include candidate and reviewer counts for full runs without exposing hidden
  reasoning.
- Add optional limits for candidate count, reviewer count, or an equivalent
  deliberation budget.
- Degrade safely from full to mini or direct when the configured budget is
  insufficient, and disclose the degradation when it affects confidence.
- Add deterministic routing and regression tests covering direct, mini, full,
  repeated-decision, and budget-degradation behavior.

## Planned milestone: 0.2.0

### Configurable decision memory

- Support `off`, `session`, `project`, and `global` memory scopes.
- Resolve settings in this order: request override, project configuration,
  global configuration, then the default scope.
- Choose the default scope during the approved design process, with privacy and
  least-surprise behavior taking priority.
- Store compact decision records, assumptions, uncertainty, provenance, and
  reconsideration triggers without storing hidden reasoning.
- Reuse a remembered decision only when the request and material assumptions
  remain compatible; reject stale or conflicting records.
- Provide clear ways to inspect, forget, and disable stored memory.
- Define storage locations, retention, redaction, portability, concurrent
  access, and failure behavior before implementation.
- Add tests for scope precedence, opt-out behavior, stale-record rejection,
  deletion, and the prohibition on persisting hidden reasoning.

Because npm package versions are immutable, none of this work will modify
`0.1.58`. The `0.1.60` release remains optional: its work may move into `0.2.0`
if a separate interim release would not provide enough user value.
