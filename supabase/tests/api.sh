#!/usr/bin/env bash
# Runs the app's queries against a real PostgREST over a local Postgres with every migration.
# Catches what the mocked e2e tests cannot (e.g. an ambiguous embed answering 400).
# Needs Postgres binaries (preinstalled on GitHub's ubuntu runners). Usage: npm run test:api
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
POSTGREST_VERSION=12.2.3
CACHE="$ROOT/node_modules/.cache/postgrest"
WORK=$(mktemp -d)
PG_PORT=54399
API_PORT=35555
export API_URL="http://localhost:$API_PORT" JWT_SECRET="local-test-secret-local-test-secret-32"

as_db_user() { if [ "$(id -u)" = 0 ]; then su nobody -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
cleanup() {
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
  as_db_user "$PGBIN/pg_ctl -D $WORK/data -m immediate stop" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

if [ ! -x "$CACHE/postgrest" ]; then
  mkdir -p "$CACHE"
  curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/v$POSTGREST_VERSION/postgrest-v$POSTGREST_VERSION-linux-static-x64.tar.xz" | tar -xJ -C "$CACHE"
fi

chmod 777 "$WORK"
as_db_user "$PGBIN/initdb -D $WORK/data -U postgres -A trust >/dev/null"
as_db_user "$PGBIN/pg_ctl -D $WORK/data -o '-p $PG_PORT -k $WORK -c listen_addresses=localhost' -l $WORK/pg.log -w start >/dev/null"

PSQL="psql -h localhost -p $PG_PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -c "create role authenticator noinherit login password 'test'"
$PSQL -f "$ROOT/supabase/tests/stub_supabase.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do $PSQL -f "$f"; done
$PSQL -c "grant anon, authenticated to authenticator"

cat > "$WORK/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:test@localhost:$PG_PORT/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = $API_PORT
CONF
"$CACHE/postgrest" "$WORK/postgrest.conf" > "$WORK/postgrest.log" 2>&1 &
API_PID=$!
for _ in $(seq 1 50); do curl -fs "$API_URL/" >/dev/null 2>&1 && break; sleep 0.2; done

PGPORT=$PG_PORT node --experimental-strip-types --no-warnings "$ROOT/supabase/tests/api.mjs"
