# Pruebas

| Prueba | Qué comprueba | Cómo se lanza |
|---|---|---|
| Unitarias (Vitest) | Validación de NIF/NIE/CIF, teléfonos, fechas, superficies… | `npm test` |
| Base de datos (PGlite) | El esquema SQL y los permisos de cada rol, en un PostgreSQL en memoria | `npm run prueba:bd` |
| Extremo a extremo: socios | Altas, validación, sin conexión, conflictos, permisos, 2.500 socios | `node pruebas/e2e-socios.mjs` (ver abajo) |
| Extremo a extremo: mapa | Capas PNOA y SIGPAC, fincas dibujadas, consulta de recintos, mi posición, buscar parcela, crear finca desde un recinto, filtros, sin conexión | `node pruebas/e2e-mapa.mjs` (ver abajo) |
| Extremo a extremo: informes | Totales por cultivo/municipio/certificación/tipo, filtros, enlaces a la lista de fincas y Excel (se abre el .xlsx descargado), permisos, sin conexión | `node pruebas/e2e-informes.mjs` (ver abajo) |
| Extremo a extremo: mapas sin conexión | Descargar alrededor de las fincas y una zona del mapa, verlas sin red, cancelar, cortes de red, completar, zonas enormes, borrar | `node pruebas/e2e-zonas.mjs` (ver abajo) |
| Extremo a extremo: fincas | Fincas con recintos SIGPAC, GPS, fotos (también sin conexión y rechazadas), filtros, borrado en cascada | `node pruebas/e2e-fincas.mjs` (ver abajo) |

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

# 4. Lanzar las pruebas (las capturas quedan en pruebas/capturas)
node pruebas/e2e-socios.mjs
bash pruebas/preparar-supabase-local.sh     # empezar de cero
node pruebas/e2e-fincas.mjs
bash pruebas/preparar-supabase-local.sh     # empezar de cero
node pruebas/e2e-mapa.mjs
bash pruebas/preparar-supabase-local.sh     # empezar de cero
node pruebas/e2e-informes.mjs
bash pruebas/preparar-supabase-local.sh     # empezar de cero
node pruebas/e2e-zonas.mjs
```

Antes de repetir una prueba hay que volver a ejecutar el paso 2 para empezar con la base de datos vacía.

Las pruebas de fincas y mapa **simulan el SIGPAC** con respuestas reales grabadas en
`pruebas/fixtures/sigpac/` (y las teselas del mapa con una imagen plana), para que no dependan de
que los servicios públicos estén disponibles. Está en `pruebas/ayudas.mjs`. Con `SIGPAC_REAL=1`
usan los servicios de verdad (puede fallar si el FEGA o el IGN no responden).

Variables útiles: `APP_URL` (por defecto `http://localhost:4173`), `DB_CONTAINER` (el contenedor
de la base de datos de Supabase local) y `PLAYWRIGHT_MODULE` (ruta a Playwright si no está en el proyecto).
