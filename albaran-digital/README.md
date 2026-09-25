# Albarán Digital — MVP

Digitaliza albaranes de proveedores (foto o PDF) usando la API de Claude para extraer los
datos, permite corregirlos en una tabla editable, y los guarda en una tabla maestra
exportable a CSV con el formato que espera cualquier ERP.

## Flujo

1. **Subir albarán** — arrastra o selecciona una foto/PDF.
2. **Extraer datos** — llama a la API de Claude (`claude-sonnet-4-6`) con el documento y
   devuelve proveedor, nº de albarán, fecha, líneas de producto y total en JSON.
3. **Revisión humana** — los datos aparecen en una tabla editable. Corrige lo que el OCR
   no haya leído bien; este paso es obligatorio, nada se guarda sin confirmar.
4. **Confirmar** — se guarda en SQLite, en el espacio de la empresa (`tenant_id`).
5. **Histórico + export** — lista de albaranes guardados y botón para exportar CSV.

## Stack

- **Backend**: Node.js + Express (proceso único, sin colas ni microservicios).
- **Almacenamiento**: SQLite vía el módulo nativo `node:sqlite` de Node (≥ 22.5), sin
  dependencias de compilación nativa. Es una API experimental de Node; si diera problemas
  en tu versión de Node, sustituye `src/db.js` por `better-sqlite3` sin tocar el resto.
- **OCR/extracción**: `@anthropic-ai/sdk`, modelo `claude-sonnet-4-6`, con salida forzada
  a JSON mediante *tool use* (la extracción nunca puede devolver texto libre).
- **Frontend**: HTML + JS vanilla, sin frameworks ni librerías de diseño.

## Poner en marcha en local

```bash
cd albaran-digital
cp .env.example .env
# edita .env y pon tu ANTHROPIC_API_KEY
npm install
npm start
```

Abre `http://localhost:3000`.

Requiere **Node.js 22.5 o superior** (por `node:sqlite`). Comprueba tu versión con `node -v`.

## Multi-tenant (MVP)

No hay login. Cada usuario escribe el nombre de su empresa en el campo "Empresa" de la
web (se guarda en `localStorage` del navegador) y ese valor se usa como `tenant_id` para
aislar los datos de cada comercializadora en la misma base de datos. Para producción,
sustituir por autenticación real (usuario/contraseña o magic link) que fije el
`tenant_id` en servidor en vez de confiar en el cliente.

## Endpoints

- `POST /albaranes/extraer` — `multipart/form-data` con campos `archivo` (PDF/imagen) y
  `tenant_id`. Devuelve el JSON extraído, **sin persistir**.
- `POST /albaranes/confirmar` — JSON con `tenant_id`, `proveedor`, `numero_albaran`,
  `fecha`, `total`, `lineas: [{producto, cantidad, unidad, precio_unitario, importe}]`.
  Persiste el albarán.
- `GET /albaranes?tenant_id=...` — listado histórico del tenant.
- `GET /albaranes/export?tenant_id=...` — CSV con columnas:
  `numero_albaran; fecha; proveedor; producto; cantidad; unidad; precio_unitario; importe; total_albaran`

## Base de datos

Archivo único `data/albaranes.sqlite` (ignorado por git), con dos tablas:

- `albaranes`: cabecera (proveedor, número, fecha, total, tenant_id).
- `lineas_albaran`: líneas de producto, referenciando `albaran_id`.

## Migrar a Postgres

Cuando el volumen lo justifique:

1. Sustituye `src/db.js` por un pool de `pg` (o un ORM como Drizzle/Prisma) manteniendo
   el mismo esquema de dos tablas (`albaranes`, `lineas_albaran`) más `tenant_id`.
2. Cambia `db.prepare(...).run(...)`/`.all(...)` en `src/routes/albaranes.js` por las
   consultas equivalentes en `pg` (son las únicas dos zonas que tocan la base de datos).
3. Añade índices por `tenant_id` (ya presentes en el esquema SQLite) y considera
   Row Level Security si vas a tener muchos tenants en la misma base.

## Desplegar

Recomendado: **Railway** o **Render**, plan barato, sin fricción.

1. Sube este directorio (`albaran-digital/`) como el repo/servicio a desplegar.
2. Configura la variable de entorno `ANTHROPIC_API_KEY` en el panel del proveedor.
3. Comando de arranque: `npm install && npm start`.
4. Si el proveedor no soporta Node 22 nativamente, fija la versión en `package.json`
   (`engines.node`) o cambia a `better-sqlite3` como se indica arriba.
5. El disco de esos planes suele ser efímero entre despliegues: para persistencia real,
   monta un volumen para `data/` o migra a Postgres (ver sección anterior) antes de tener
   clientes de pago.

## Limitaciones conocidas del MVP (a propósito)

- Sin autenticación real, sin roles, sin recuperación de contraseña.
- Sin reintentos ni cola si la API de Claude falla — el usuario simplemente rellena a
  mano ese albarán.
- Un único formato de export CSV "genérico"; el mapeo a cada ERP concreto lo hace cada
  cliente por ahora.

Nada de esto se añade hasta que el uso real (tus propios ~50 albaranes/día) demuestre que
hace falta.
