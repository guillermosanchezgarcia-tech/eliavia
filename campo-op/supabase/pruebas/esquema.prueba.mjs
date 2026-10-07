// Prueba del esquema de la base de datos con un PostgreSQL en memoria (PGlite).
// Simula lo mínimo de Supabase (usuarios, auth.uid(), storage) y comprueba los
// permisos de cada rol. Se ejecuta con: npm run prueba:bd

import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const sql = readFileSync(process.argv[2], 'utf8')
const db = new PGlite()

// Stubs mínimos de lo que Supabase ya trae
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}',
    created_at timestamptz default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema public to authenticated, anon;
`)

// Un usuario creado ANTES de ejecutar el esquema (para probar la migración)
await db.exec(`insert into auth.users (email, created_at) values ('previo@op.es', now() - interval '1 day')`)

await db.exec(sql)
await db.exec(sql) // idempotente
console.log('✔ esquema ejecutado dos veces sin errores')

await db.exec(`insert into auth.users (email, raw_user_meta_data) values ('tecnico@op.es', '{"nombre":"Ana Técnica"}')`)
await db.exec(`insert into auth.users (email) values ('otro@op.es')`)
const perfiles = (await db.query(`select email, nombre, rol from public.perfiles order by created_at`)).rows
console.log(perfiles)

const id = async (email) => (await db.query(`select id from auth.users where email = $1`, [email])).rows[0].id
const admin = await id('previo@op.es')
const tecnico = await id('tecnico@op.es')
const otro = await id('otro@op.es')

async function como(uid, q, params) {
  await db.exec(`reset role`)
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
  await db.exec(`set role authenticated`)
  try {
    return { ok: true, res: await db.query(q, params) }
  } catch (e) {
    return { ok: false, err: e.message }
  } finally {
    await db.exec(`reset role`)
  }
}

let fallos = 0
function esperar(nombre, r, ok) {
  const bien = r.ok === ok
  if (!bien) fallos++
  console.log(`${bien ? '✔' : '✘'} ${nombre} → ${r.ok ? 'permitido' : 'denegado: ' + r.err}`)
}

esperar('técnico crea socio', await como(tecnico, `insert into public.socios (codigo, nombre) values ('T1','x')`), false)
const s = await como(admin, `insert into public.socios (codigo, nombre) values ('001','Agrícola Pérez SL') returning id, created_by, updated_at`)
esperar('admin crea socio', s, true)
const socioId = s.res.rows[0].id
console.log('   created_by = admin:', s.res.rows[0].created_by === admin)
esperar('admin crea socio con código repetido', await como(admin, `insert into public.socios (codigo, nombre) values ('001','Otro')`), false)
esperar('técnico ve socios', await como(tecnico, `select * from public.socios`), true)
console.log('   filas vistas por técnico:', (await como(tecnico, `select * from public.socios`)).res.rows.length)
esperar('técnico edita socio', await como(tecnico, `update public.socios set telefono = '600000000' where id = $1`, [socioId]), true)
esperar('técnico elimina socio', await como(tecnico, `update public.socios set eliminado = true where id = $1`, [socioId]), false)
esperar('técnico borra socio (delete)', await como(tecnico, `delete from public.socios where id = $1 returning id`, [socioId]), true)
console.log('   socios que siguen existiendo:', (await db.query(`select count(*) from public.socios`)).rows[0].count)

const f = await como(tecnico, `insert into public.fincas (socio_id, nombre, tipo, tipo_invernadero, superficie_ha, certificaciones) values ($1, 'Finca La Loma', 'invernadero', 'raspa_amagado', 1.2345, '{GlobalG.A.P.}') returning id`, [socioId])
esperar('técnico crea finca', f, true)
const fincaId = f.res.rows[0].id
esperar('técnico añade recinto', await como(tecnico, `insert into public.recintos (finca_id, municipio, poligono, parcela, recinto, geometria) values ($1, 104, 4, 9000, 77, '{"type":"Polygon","coordinates":[]}')`, [fincaId]), true)
esperar('técnico añade foto', await como(tecnico, `insert into public.fotos (finca_id, ruta) values ($1, 'x.jpg')`, [fincaId]), true)
esperar('técnico elimina finca', await como(tecnico, `update public.fincas set eliminado = true where id = $1`, [fincaId]), false)
esperar('tipo de finca no válido', await como(tecnico, `update public.fincas set tipo = 'cueva' where id = $1`, [fincaId]), false)
esperar('técnico se hace admin', await como(tecnico, `update public.perfiles set rol = 'admin' where id = $1`, [tecnico]), false)
esperar('técnico cambia su nombre', await como(tecnico, `update public.perfiles set nombre = 'Ana' where id = $1`, [tecnico]), true)
esperar('admin se quita el rol siendo el único', await como(admin, `update public.perfiles set rol = 'tecnico' where id = $1`, [admin]), false)
esperar('admin desactiva a otro', await como(admin, `update public.perfiles set activo = false where id = $1`, [otro]), true)
const vistoDesactivado = await como(otro, `select * from public.socios`)
console.log(`${vistoDesactivado.res.rows.length === 0 ? '✔' : '✘'} usuario desactivado ve ${vistoDesactivado.res.rows.length} socios`)
const anon = await como(null, `select * from public.socios`)
console.log(`${anon.res.rows.length === 0 ? '✔' : '✘'} sin sesión ve ${anon.res.rows.length} socios`)

const antes = (await db.query(`select updated_at from public.fincas where id = $1`, [fincaId])).rows[0].updated_at
esperar('admin elimina socio', await como(admin, `update public.socios set eliminado = true where id = $1`, [socioId]), true)
const cascada = (await db.query(`select (select eliminado from public.fincas where id = $1) f, (select bool_and(eliminado) from public.recintos where finca_id = $1) r, (select bool_and(eliminado) from public.fotos where finca_id = $1) fo, (select updated_at from public.fincas where id = $1) u`, [fincaId])).rows[0]
console.log(`${cascada.f && cascada.r && cascada.fo ? '✔' : '✘'} borrado en cascada (finca ${cascada.f}, recintos ${cascada.r}, fotos ${cascada.fo})`)
console.log(`${cascada.u >= antes ? '✔' : '✘'} updated_at de la finca actualizado`)
esperar('admin crea socio con código de uno eliminado', await como(admin, `insert into public.socios (codigo, nombre) values ('001','Nuevo')`), true)

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo correcto')
process.exit(fallos ? 1 : 0)
