#!/bin/sh
# PostgreSQL backup for the local Docker stack (docker-compose.local.yml).
#
# Runs inside the `backup` service: nightly from cron, and on demand from
# aria-local.ps1 (backup, update). Writes a pg_dump custom-format archive to
# /backups (deployment/local/backups on the host).
#
# Usage: backup.sh [label]   label defaults to "nightly"
#
# Environment: PGHOST, PGUSER, PGPASSWORD, PGDATABASE, BACKUP_RETENTION
# Only "nightly" backups are pruned here; update removes its own pre-update
# backup once the update succeeds.

set -eu

label="${1:-nightly}"
case "$label" in
	*[!A-Za-z0-9._-]* | '')
		echo "[backup] Invalid label: $label" >&2
		exit 2
		;;
esac

backup_dir=/backups
retention="${BACKUP_RETENTION:-7}"
stamp="$(date +%Y%m%d-%H%M%S)"
target="$backup_dir/aria-$label-$stamp.dump"
partial="$target.tmp"

mkdir -p "$backup_dir"
trap 'rm -f "$partial"' EXIT

echo "[backup] Writing $(basename "$target")"
pg_dump --format=custom --no-owner --file="$partial"
mv "$partial" "$target"
echo "[backup] Done: $(basename "$target") ($(du -h "$target" | cut -f1))"

if [ "$label" = "nightly" ] && [ "$retention" -gt 0 ] 2>/dev/null; then
	# Names sort by timestamp, so the newest come first in reverse order.
	ls -1 "$backup_dir"/aria-nightly-*.dump 2>/dev/null |
		sort -r |
		tail -n "+$((retention + 1))" |
		while read -r old; do
			rm -f "$old"
			echo "[backup] Pruned $(basename "$old")"
		done
fi
