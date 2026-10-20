#!/bin/sh
# Restore a backup made by backup.sh into the local Docker stack's database.
#
# Runs inside the `backup` service, called by aria-local.ps1 (restore, and the
# automatic rollback of a failed update) after the app services are stopped.
# The database is dropped and recreated so tables added by a newer migration
# do not survive a rollback.
#
# Usage: restore.sh <file name in /backups>
#
# Environment: PGHOST, PGUSER, PGPASSWORD, PGDATABASE

set -eu

name="${1:-}"
case "$name" in
	'' | */* | *..*)
		echo "[restore] Pass the name of a file in deployment/local/backups" >&2
		exit 2
		;;
esac

source_file="/backups/$name"
if [ ! -f "$source_file" ]; then
	echo "[restore] Not found: $name" >&2
	exit 2
fi

# Check the archive before touching the database.
pg_restore --list "$source_file" > /dev/null

marker_prefix="aria-local-demo-data:"
marker="$(psql --dbname=postgres --tuples-only --no-align --command \
	"SELECT coalesce(shobj_description(oid, 'pg_database'), '') FROM pg_database WHERE datname = '$PGDATABASE'")"
case "$marker" in
	"$marker_prefix"*) ;;
	# Keeps the demo loader from loading on top of restored data.
	*) marker="${marker_prefix}restored@$(date -u +%Y-%m-%dT%H:%M:%SZ)" ;;
esac

echo "[restore] Recreating database $PGDATABASE"
dropdb --maintenance-db=postgres --if-exists --force "$PGDATABASE"
createdb --maintenance-db=postgres "$PGDATABASE"

echo "[restore] Restoring $name"
pg_restore --no-owner --exit-on-error --dbname="$PGDATABASE" "$source_file"

psql --dbname="$PGDATABASE" --quiet --set=ON_ERROR_STOP=1 --command \
	"COMMENT ON DATABASE \"$PGDATABASE\" IS '$marker'"
echo "[restore] Done"
