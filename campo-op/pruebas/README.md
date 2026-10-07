# Pruebas

| Prueba | Qué comprueba | Cómo se lanza |
|---|---|---|
| Unitarias (Vitest) | Validación de NIF/NIE/CIF, teléfonos, fechas, superficies… | `npm test` |
| Base de datos (PGlite) | El esquema SQL y los permisos de cada rol, en un PostgreSQL en memoria | `npm run prueba:bd` |
| Extremo a extremo | La app completa en un navegador contra un Supabase real en Docker | ver abajo |

## Prueba de extremo a extremo

Necesita Docker, la CLI de Supabase (`npx supabase`) y Playwright con Chromium
(`npm i -g playwright && npx playwright install chromium`).

```bash
cd campo-op

# 1. Arrancar un Supabase local (la primera vez descarga las imágenes de Docker)
npx supabase init            # solo la primera vez: crea supabase/config.toml
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit,realtime,postgres-meta

# 2. Aplicar el esquema, vaciar los datos y crear los usuarios de prueba
bash pruebas/preparar-supabase-local.sh

# 3. Compilar la app apuntando al Supabase local y servirla
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_PUBLISHABLE_KEY=$(npx supabase status -o env | grep '^PUBLISHABLE_KEY=' | cut -d'"' -f2) \
npm run build && npx vite preview --port 4173 &

# 4. Lanzar la prueba (las capturas quedan en pruebas/capturas)
node pruebas/e2e-socios.mjs
```

Antes de repetirla hay que volver a ejecutar el paso 2 para empezar con la base de datos vacía.
