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
#   ./scripts/vendor-repos.sh --pull   # update all existing clones (skips .erpnext)
#   ./scripts/vendor-repos.sh --update-erpnext  # show upstream ERPNext tip (pin unchanged)
#
# ERPNext is vendored separately into .erpnext/ (sparse, shallow, pinned to
# ERPNEXT_REF) because it needs a sparse checkout and a reproducible commit.
#
# See VENDORED_REPOS.md for rationale and maintenance guidance.

set -euo pipefail

REPOS_DIR="repos"
MODE="${1:-add}"

# ERPNext reference source (read-only, GPLv3: never copy files into tracked code).
ERPNEXT_DIR=".erpnext"
ERPNEXT_URL="https://github.com/frappe/erpnext.git"
ERPNEXT_BRANCH="develop"
# Pinned develop tip: __DATE__, __version__ = "17.0.0-dev".
# Bump only via ./scripts/vendor-repos.sh --update-erpnext, then review.
ERPNEXT_REF="ea8fb11e745682044f7c24ea1d8ce9c4685582a2"
ERPNEXT_SPARSE_PATHS=(erpnext/assets erpnext/accounts erpnext/stock erpnext/controllers)
ERPNEXT_SPARSE_FILES=(erpnext/hooks.py erpnext/__init__.py erpnext/exceptions.py license.txt)

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

# ─── ERPNext ─────────────────────────────────────────────────────────────────

vendor_erpnext() {
  if [ -d "$ERPNEXT_DIR" ] && [ ! -e "$ERPNEXT_DIR/.git" ]; then
    err "$ERPNEXT_DIR exists but is not a git checkout (legacy hand-copied folder)."
    err "Left untouched. For the pinned checkout: mv $ERPNEXT_DIR $ERPNEXT_DIR.bak && ./scripts/vendor-repos.sh"
    return 0
  fi

  if [ -e "$ERPNEXT_DIR/.git" ]; then
    local head
    head="$(git -C "$ERPNEXT_DIR" rev-parse HEAD 2>/dev/null || true)"
    if [ "$head" = "$ERPNEXT_REF" ]; then
      ok "$ERPNEXT_DIR already at pinned commit ${ERPNEXT_REF:0:12} — skipping."
      return 0
    fi
    log "$ERPNEXT_DIR is at ${head:-unknown}; moving to pinned commit ${ERPNEXT_REF:0:12}..."
    git -C "$ERPNEXT_DIR" fetch --depth 1 origin "$ERPNEXT_REF"
    git -C "$ERPNEXT_DIR" checkout --detach "$ERPNEXT_REF"
    ok "$ERPNEXT_DIR now at pinned commit ${ERPNEXT_REF:0:12}"
    return 0
  fi

  log "Cloning ERPNext (sparse, shallow) into $ERPNEXT_DIR/..."
  git clone --depth 1 --filter=blob:none --no-checkout --branch "$ERPNEXT_BRANCH" \
    "$ERPNEXT_URL" "$ERPNEXT_DIR"
  local patterns=() p
  for p in "${ERPNEXT_SPARSE_PATHS[@]}"; do patterns+=("/$p/"); done
  for p in "${ERPNEXT_SPARSE_FILES[@]}"; do patterns+=("/$p"); done
  git -C "$ERPNEXT_DIR" sparse-checkout set --no-cone "${patterns[@]}"
  git -C "$ERPNEXT_DIR" fetch --depth 1 origin "$ERPNEXT_REF"
  git -C "$ERPNEXT_DIR" checkout --detach "$ERPNEXT_REF"
  ok "Added $ERPNEXT_DIR at pinned commit ${ERPNEXT_REF:0:12}"
}

update_erpnext() {
  if [ ! -e "$ERPNEXT_DIR/.git" ]; then
    err "$ERPNEXT_DIR is not a git checkout — run ./scripts/vendor-repos.sh first."
    return 1
  fi
  log "Fetching $ERPNEXT_BRANCH tip from $ERPNEXT_URL..."
  git -C "$ERPNEXT_DIR" fetch --depth 20 origin "$ERPNEXT_BRANCH"
  echo ""
  log "Upstream $ERPNEXT_BRANCH, newest first:"
  git -C "$ERPNEXT_DIR" log --oneline -n 20 FETCH_HEAD
  echo ""
  log "Upstream tip: $(git -C "$ERPNEXT_DIR" rev-parse FETCH_HEAD)"
  log "Current pin:  $ERPNEXT_REF"
  echo "The pin was NOT changed. To adopt a new commit: review the log, edit ERPNEXT_REF"
  echo "in scripts/vendor-repos.sh (plus its date/version comment and VENDORED_REPOS.md),"
  echo "then re-run ./scripts/vendor-repos.sh."
}

# ─── Main ────────────────────────────────────────────────────────────────────

if [ "$MODE" = "--update-erpnext" ]; then
  update_erpnext
  exit $?
fi

mkdir -p "$REPOS_DIR"

if [ "$MODE" = "--pull" ]; then
  log "Skipping $ERPNEXT_DIR (pinned to ${ERPNEXT_REF:0:12}; use --update-erpnext to review upstream)."
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
vendor_erpnext || { err "ERPNext vendoring failed"; exit 1; }

echo ""
ok "All repositories cloned under $REPOS_DIR/"
echo ""
echo "Next step: add repos/ to your editor exclusions (see VENDORED_REPOS.md)"
