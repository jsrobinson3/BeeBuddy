#!/bin/bash
# Install git hooks for the BeeBuddy project.
# Run from repo root: ./scripts/install-hooks.sh

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
SCRIPTS_DIR="$REPO_ROOT/scripts"

echo "Installing git hooks..."

for hook in pre-commit; do
  src="$SCRIPTS_DIR/$hook"
  dest="$HOOKS_DIR/$hook"

  if [ ! -f "$src" ]; then
    echo "  ⚠ $src not found — skipping"
    continue
  fi

  cp "$src" "$dest"
  chmod +x "$dest"
  echo "  ✓ Installed $hook"
done

echo "Done. Git hooks are active."
