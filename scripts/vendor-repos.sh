#!/usr/bin/env bash
# Vendor external repositories as git subtrees for coding agent reference.
#
# This script adds read-only copies of key dependency source trees under repos/
# so that coding agents can explore real implementations instead of guessing.
#
# Usage:
#   ./scripts/vendor-repos.sh          # vendor all repos
#   ./scripts/vendor-repos.sh --pull   # update all existing subtrees
#
# See VENDORED_REPOS.md for rationale and maintenance guidance.

set -euo pipefail

REPOS_DIR="repos"
MODE="${1:-add}"

# ─── Helpers ─────────────────────────────────────────────────────────────────

log() { echo -e "\033[1;34m▶\033[0m $*"; }
ok()  { echo -e "\033[1;32m✔\033[0m $*"; }
err() { echo -e "\033[1;31m✘\033[0m $*" >&2; }

# ─── Repo definitions ────────────────────────────────────────────────────────
# Format: "prefix|repo_url|branch"
REPOS=(
  "repos/trpc|https://github.com/trpc/trpc.git|main"
  "repos/better-auth|https://github.com/better-auth/better-auth.git|main"
  "repos/zod|https://github.com/colinhacks/zod.git|main"
  "repos/nest|https://github.com/nestjs/nest.git|master"
  "repos/prisma|https://github.com/prisma/prisma.git|main"
  "repos/tanstack-table|https://github.com/TanStack/table.git|main"
  "repos/react-hook-form|https://github.com/react-hook-form/react-hook-form.git|master"
  "repos/dnd-kit|https://github.com/clauderic/dnd-kit.git|main"
  "repos/nuqs|https://github.com/47ng/nuqs.git|next"
  "repos/zustand|https://github.com/pmndrs/zustand.git|main"
  "repos/recharts|https://github.com/recharts/recharts.git|main"
  "repos/date-fns|https://github.com/date-fns/date-fns.git|main"
  "repos/biome|https://github.com/biomejs/biome.git|main"
)

# ─── Auto-stash ──────────────────────────────────────────────────────────────
# git subtree requires a clean working tree. Stash uncommitted changes and
# restore them when the script exits (success or failure).

STASHED=false

restore_stash() {
  if [ "$STASHED" = true ]; then
    echo ""
    log "Restoring stashed changes..."
    git stash pop
    ok "Stash restored."
  fi
}
trap restore_stash EXIT

if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
  log "Working tree has uncommitted changes — stashing temporarily..."
  git stash push -m "vendor-repos: auto-stash"
  STASHED=true
fi

# ─── Main ────────────────────────────────────────────────────────────────────

if [ "$MODE" = "--pull" ]; then
  log "Updating all vendored subtrees..."
  for entry in "${REPOS[@]}"; do
    IFS='|' read -r prefix repo branch <<< "$entry"
    log "Pulling $prefix from $repo ($branch)..."
    if git subtree pull --prefix="$prefix" "$repo" "$branch" --squash -m "chore(vendor): update $prefix" 2>/dev/null; then
      ok "Updated $prefix"
    else
      err "Failed to update $prefix — subtree may not exist yet. Run without --pull first."
    fi
  done
  echo ""
  ok "All subtrees updated."
  exit 0
fi

log "Vendoring external repositories into $REPOS_DIR/..."
echo ""

for entry in "${REPOS[@]}"; do
  IFS='|' read -r prefix repo branch <<< "$entry"

  # Skip if already vendored
  if [ -d "$prefix" ]; then
    ok "$prefix already exists — skipping."
    continue
  fi

  log "Adding $prefix from $repo ($branch)..."
  if git subtree add --prefix="$prefix" "$repo" "$branch" --squash -m "chore(vendor): add $prefix"; then
    ok "Added $prefix"
  else
    err "Failed to add $prefix"
    exit 1
  fi
  echo ""
done

echo ""
ok "All repositories vendored successfully under $REPOS_DIR/"
echo ""
echo "Next steps:"
echo "  1. Add repos/ to your .vscode/settings.json exclusions (see VENDORED_REPOS.md)"
echo "  2. Commit: git add -A && git commit -m 'chore(vendor): add dependency source trees'"
