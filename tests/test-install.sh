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
home_all="$test_root/home-all"
mkdir -p "$home_all"

HOME="$home_all" "$repo_root/install.sh" --all --yes >"$test_root/all.out"

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
grep -F "QUORUM v0.1.57" "$test_root/all.out" >/dev/null

home_selected="$test_root/home-selected"
mkdir -p "$home_selected"
HOME="$home_selected" "$repo_root/install.sh" --targets codex,cursor --yes >"$test_root/selected.out"
test -f "$home_selected/.agents/skills/quorum/SKILL.md"
test -f "$home_selected/.cursor/skills/quorum/SKILL.md"
test ! -e "$home_selected/.claude/skills/quorum"

project_dry="$test_root/project-dry"
mkdir -p "$project_dry"
"$repo_root/install.sh" --all --scope project --project-root "$project_dry" --dry-run >"$test_root/dry.out"
test ! -e "$project_dry/.agents/skills/quorum"
grep -F "PLAN      install" "$test_root/dry.out" >/dev/null

printf 'changed\n' >"$home_selected/.cursor/skills/quorum/SKILL.md"
HOME="$home_selected" "$repo_root/install.sh" --targets cursor --yes >"$test_root/update.out"
find "$home_selected/.cursor/skills" -maxdepth 1 -type d -name 'quorum.backup-*' | grep . >/dev/null

if command -v pwsh >/dev/null 2>&1; then
  pwsh -NoProfile -File "$repo_root/install.ps1" --targets codex --scope project --project-root "$project_dry" --dry-run >"$test_root/powershell.out"
  grep -F "QUORUM v0.1.57" "$test_root/powershell.out" >/dev/null
else
  echo "PowerShell smoke test skipped: pwsh is unavailable"
fi

echo "Installer integration tests passed"
