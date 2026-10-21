#!/usr/bin/env bash
# Clone external repositories for coding agent reference.
#
# This script adds read-only shallow clones of key dependency source trees under
# repos/ so that coding agents can explore real implementations instead of
# guessing. repos/ is gitignored: the clones stay on your machine and are never
# committed (each keeps its own upstream license).
#
# Usage:
#   ./scripts/vendor-repos.sh          # clone all repos
#   ./scripts/vendor-repos.sh --pull   # update all existing clones
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

# ─── Main ────────────────────────────────────────────────────────────────────

mkdir -p "$REPOS_DIR"

if [ "$MODE" = "--pull" ]; then
  log "Updating all vendored clones..."
  for entry in "${REPOS[@]}"; do
    IFS='|' read -r prefix repo branch <<< "$entry"
    if [ ! -d "$prefix/.git" ]; then
      err "$prefix is not a clone — delete it and run without --pull."
      continue
    fi
    log "Pulling $prefix ($branch)..."
    if git -C "$prefix" pull --ff-only --depth 1 origin "$branch"; then
      ok "Updated $prefix"
    else
      err "Failed to update $prefix"
    fi
  done
  echo ""
  ok "All clones updated."
  exit 0
fi

log "Cloning external repositories into $REPOS_DIR/..."
echo ""

for entry in "${REPOS[@]}"; do
  IFS='|' read -r prefix repo branch <<< "$entry"

  # Skip if already vendored
  if [ -d "$prefix" ]; then
    ok "$prefix already exists — skipping."
    continue
  fi

  log "Cloning $prefix from $repo ($branch)..."
  if git clone --depth 1 --branch "$branch" "$repo" "$prefix"; then
    ok "Added $prefix"
  else
    err "Failed to clone $prefix"
    exit 1
  fi
  echo ""
done

echo ""
ok "All repositories cloned under $REPOS_DIR/"
echo ""
echo "Next step: add repos/ to your editor exclusions (see VENDORED_REPOS.md)"
