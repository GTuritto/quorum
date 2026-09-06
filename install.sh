#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v node >/dev/null 2>&1; then
  echo "Quorum requires Node.js 18 or later." >&2
  exit 1
fi

exec node "$script_dir/installer/install.mjs" "$@"
