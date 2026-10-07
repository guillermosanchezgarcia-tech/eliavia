#!/usr/bin/env bash
# Deja el Supabase local (Docker) listo para las pruebas de extremo a extremo:
# aplica el esquema, vacía los datos y crea dos usuarios de prueba.
#
#   admin@op.es    (administrador)   contraseña: clave-segura-1
#   tecnico@op.es  (técnico)         contraseña: clave-segura-1
#
# Uso (desde la carpeta campo-op, con «npx supabase start» ya arrancado):
#   bash pruebas/preparar-supabase-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB="${DB_CONTAINER:-supabase_db_campo-op}"
API="${SUPABASE_URL:-http://127.0.0.1:54321}"
SRK="${SERVICE_ROLE_KEY:-$(npx --yes supabase status -o env 2>/dev/null | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)}"

psql() { docker exec -i "$DB" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 "$@"; }

psql < supabase/01_esquema.sql 2>/dev/null
psql -c "truncate public.fotos, public.recintos, public.fincas, public.socios cascade; delete from auth.users;"

crear_usuario() {
  curl -sf -X POST "$API/auth/v1/admin/users" \
    -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"clave-segura-1\",\"email_confirm\":true,\"user_metadata\":{\"nombre\":\"$2\"}}" > /dev/null
  sleep 1 # el primero en crearse es el administrador
}
crear_usuario admin@op.es "Ana Martínez"
crear_usuario tecnico@op.es "Pedro López"

docker exec "$DB" psql -U postgres -d postgres -tA -c "select email || ' → ' || rol from public.perfiles order by created_at"
