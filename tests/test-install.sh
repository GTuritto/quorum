#!/bin/sh

set -eu

test_root=$(mktemp -d "${TMPDIR:-/tmp}/quorum-install-test.XXXXXX")
cleanup() {
  if [ -n "${test_root:-}" ] && [ -d "$test_root" ]; then
    rm -rf -- "$test_root"
  fi
}
trap cleanup EXIT HUP INT TERM

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
node_path=$(command -v node)
test_installer="$repo_root/tests/run-installer.mjs"

"$repo_root/install.sh" --version >"$test_root/version.out"
test "$(sed -n '1p' "$test_root/version.out")" = "quorum-skill 0.1.59"

home_all="$test_root/home-all"
mkdir -p "$home_all"

QUORUM_TEST_HOME="$home_all" "$node_path" "$test_installer" --all --yes >"$test_root/all.out"

for skill_file in \
  "$home_all/.agents/skills/quorum/SKILL.md" \
  "$home_all/.claude/skills/quorum/SKILL.md" \
  "$home_all/.gemini/config/skills/quorum/SKILL.md" \
  "$home_all/.copilot/skills/quorum/SKILL.md" \
  "$home_all/.cursor/skills/quorum/SKILL.md"
do
  test -f "$skill_file"
done

test -f "$home_all/.agents/skills/quorum/agents/openai.yaml"
test ! -e "$home_all/.claude/skills/quorum/agents/openai.yaml"
test ! -e "$home_all/.cursor/skills/quorum/installer/install.mjs"
grep -F "QUORUM v0.1.59" "$test_root/all.out" >/dev/null

home_selected="$test_root/home-selected"
mkdir -p "$home_selected"
QUORUM_TEST_HOME="$home_selected" "$node_path" "$test_installer" --targets codex,cursor --yes >"$test_root/selected.out"
test -f "$home_selected/.agents/skills/quorum/SKILL.md"
test -f "$home_selected/.cursor/skills/quorum/SKILL.md"
test ! -e "$home_selected/.claude/skills/quorum"

project_dry="$test_root/project-dry"
mkdir -p "$project_dry"
"$repo_root/install.sh" --all --scope project --project-root "$project_dry" --dry-run >"$test_root/dry.out"
test ! -e "$project_dry/.agents/skills/quorum"
grep -F "PLAN      install" "$test_root/dry.out" >/dev/null

printf '\n# locally modified\n' >>"$home_selected/.cursor/skills/quorum/SKILL.md"
QUORUM_TEST_HOME="$home_selected" "$node_path" "$test_installer" --update --targets cursor --yes >"$test_root/update.out"
find "$home_selected/.cursor/skills" -maxdepth 1 -type d -name 'quorum.backup-*' | grep . >/dev/null
grep -F "UPDATED" "$test_root/update.out" >/dev/null

fake_bin="$test_root/fake-bin"
home_detected="$test_root/home-detected"
mkdir -p "$fake_bin" "$home_detected"
touch "$fake_bin/codex" "$fake_bin/claude"
chmod +x "$fake_bin/codex" "$fake_bin/claude"
QUORUM_TEST_HOME="$home_detected" PATH="$fake_bin" "$node_path" "$test_installer" --yes >"$test_root/detected.out"
test -f "$home_detected/.agents/skills/quorum/SKILL.md"
test -f "$home_detected/.claude/skills/quorum/SKILL.md"
grep -F "Detected Codex (command: codex)" "$test_root/detected.out" >/dev/null
grep -F "Detected Claude Code (command: claude)" "$test_root/detected.out" >/dev/null

custom_parent="$test_root/custom-skills"
"$repo_root/install.sh" --skills-dir "$custom_parent" --yes >"$test_root/custom-install.out"
test -f "$custom_parent/quorum/SKILL.md"
test ! -e "$custom_parent/quorum/agents/openai.yaml"
"$repo_root/install.sh" --uninstall --skills-dir "$custom_parent" --yes >"$test_root/custom-uninstall.out"
test ! -e "$custom_parent/quorum"
test -d "$custom_parent"
grep -F "REMOVED" "$test_root/custom-uninstall.out" >/dev/null

printf '9.0.0\n' >"$home_selected/.cursor/skills/quorum/VERSION"
if QUORUM_TEST_HOME="$home_selected" "$node_path" "$test_installer" --update --targets cursor --yes >"$test_root/downgrade.out"; then
  echo "Expected downgrade refusal" >&2
  exit 1
fi
grep -F "REFUSED" "$test_root/downgrade.out" >/dev/null
test "$(sed -n '1p' "$home_selected/.cursor/skills/quorum/VERSION")" = "9.0.0"

QUORUM_TEST_HOME="$home_selected" "$node_path" "$test_installer" --uninstall --targets codex --yes >"$test_root/uninstall.out"
test ! -e "$home_selected/.agents/skills/quorum"
test -d "$home_selected/.agents/skills"

if command -v pwsh >/dev/null 2>&1; then
  pwsh -NoProfile -File "$repo_root/install.ps1" --targets codex --scope project --project-root "$project_dry" --dry-run >"$test_root/powershell.out"
  grep -F "QUORUM v0.1.59" "$test_root/powershell.out" >/dev/null
else
  echo "PowerShell smoke test skipped: pwsh is unavailable"
fi

echo "Installer integration tests passed"
