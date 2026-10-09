-- ============================================================================
--  CAMPO OP · Base de datos
-- ----------------------------------------------------------------------------
--  Cómo usarlo:
--    Supabase → tu proyecto → SQL Editor → New query → pega TODO este archivo
--    → pulsa «Run».
--
--  Se puede ejecutar varias veces sin romper nada: si algo ya existe, se
--  respeta. Cuando en partes futuras añadamos campos, bastará con volver a
--  pegar la versión nueva del archivo.
--
--  Qué crea:
--    1. perfiles   → los usuarios de la app y su rol (admin / tecnico)
--    2. socios     → los socios de la OP
--    3. fincas     → las fincas de cada socio
--    4. recintos   → las referencias SIGPAC de cada finca (puede haber varias)
--    5. fotos      → las fotos de cada finca (el archivo va al bucket «fotos»)
--    6. Reglas de seguridad: quién puede ver, crear, editar y borrar.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. PERFILES (usuarios y roles)
-- ----------------------------------------------------------------------------
create table if not exists public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  nombre      text,
  rol         text not null default 'tecnico' check (rol in ('admin', 'tecnico')),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.perfiles is 'Usuarios de la app. rol: admin o tecnico. activo=false bloquea el acceso.';


-- ¿El usuario que hace la petición es un administrador activo?
create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin' and activo
  );
$$;

-- ¿El usuario que hace la petición está dado de alta y activo?
create or replace function public.es_usuario_activo()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and activo
  );
$$;


-- Cada vez que se crea un usuario en Supabase (Authentication → Users), se le
-- crea su perfil. El PRIMER usuario de todos se convierte en administrador;
-- los siguientes empiezan como técnicos.
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfiles (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    case when exists (select 1 from public.perfiles where rol = 'admin') then 'tecnico' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();


-- Si ya había usuarios creados antes de ejecutar este archivo, les creamos
-- el perfil ahora. Si no hay ningún administrador, el más antiguo pasa a serlo.
insert into public.perfiles (id, email, nombre, rol, created_at)
select u.id, u.email, split_part(u.email, '@', 1), 'tecnico', u.created_at
from auth.users u
where u.email is not null
  and not exists (select 1 from public.perfiles p where p.id = u.id);

update public.perfiles
set rol = 'admin'
where id = (select id from public.perfiles order by created_at limit 1)
  and not exists (select 1 from public.perfiles where rol = 'admin');


-- Protección de perfiles:
--   · Solo un administrador puede cambiar el rol o desactivar a alguien.
--   · Siempre tiene que quedar al menos un administrador activo.
create or replace function public.proteger_perfil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.es_admin()
     and (new.rol is distinct from old.rol or new.activo is distinct from old.activo) then
    raise exception 'Solo un administrador puede cambiar el rol o el estado de un usuario'
      using errcode = '42501';
  end if;

  if old.rol = 'admin' and old.activo
     and (new.rol <> 'admin' or not new.activo)
     and not exists (
       select 1 from public.perfiles
       where id <> old.id and rol = 'admin' and activo
     ) then
    raise exception 'Debe quedar al menos un administrador activo';
  end if;

  new.id := old.id;
  new.email := old.email;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists proteger_perfil on public.perfiles;
create trigger proteger_perfil
  before update on public.perfiles
  for each row execute function public.proteger_perfil();


-- ----------------------------------------------------------------------------
-- Funciones comunes para socios, fincas, recintos y fotos
-- ----------------------------------------------------------------------------

-- Anota cuándo y quién modificó cada registro. La app usa «updated_at» para
-- saber qué ha cambiado desde la última sincronización.
create or replace function public.marcar_modificado()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

-- En la app nunca se borra nada de verdad: se marca «eliminado = true» para
-- que el borrado llegue también a los móviles que estaban sin conexión.
-- Eliminar socios y fincas solo lo puede hacer un administrador.
create or replace function public.solo_admin_elimina()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.eliminado and not old.eliminado
     and auth.uid() is not null and not public.es_admin() then
    raise exception 'Solo un administrador puede eliminar este registro'
      using errcode = '42501';
  end if;
  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2. SOCIOS
-- ----------------------------------------------------------------------------
create table if not exists public.socios (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null,
  nombre         text not null,                 -- nombre o razón social
  nif            text,
  telefono       text,
  email          text,
  direccion      text,
  codigo_postal  text,
  localidad      text,
  fecha_alta     date,
  estado         text not null default 'activo' check (estado in ('activo', 'baja')),
  fecha_baja     date,
  observaciones  text,
  eliminado      boolean not null default false,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.perfiles (id) on delete set null,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.perfiles (id) on delete set null
);

comment on table public.socios is 'Socios de la OP.';

-- No puede haber dos socios (no eliminados) con el mismo código.
create unique index if not exists socios_codigo_unico
  on public.socios (lower(codigo)) where not eliminado;
create index if not exists socios_updated_at on public.socios (updated_at);


-- ----------------------------------------------------------------------------
-- 3. FINCAS
-- ----------------------------------------------------------------------------
create table if not exists public.fincas (
  id                     uuid primary key default gen_random_uuid(),
  socio_id               uuid not null references public.socios (id),
  nombre                 text not null,         -- nombre o código de la finca
  provincia              integer not null default 4,   -- 4 = Almería (código SIGPAC)
  municipio              integer,               -- código SIGPAC del municipio
  tipo                   text check (tipo in ('invernadero', 'aire_libre')),
  tipo_invernadero       text check (tipo_invernadero in ('raspa_amagado', 'multitunel', 'plano', 'otro')),
  tipo_invernadero_otro  text,
  superficie_ha          numeric(12, 4) check (superficie_ha >= 0),
  cultivo                text,
  campana                text,                  -- p. ej. «2026/2027»
  latitud                double precision check (latitud between -90 and 90),
  longitud               double precision check (longitud between -180 and 180),
  certificaciones        text[] not null default '{}',
  observaciones          text,
  fecha_ultima_visita    date,
  eliminado              boolean not null default false,
  created_at             timestamptz not null default now(),
  created_by             uuid references public.perfiles (id) on delete set null,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references public.perfiles (id) on delete set null
);

comment on table public.fincas is 'Fincas de los socios. La superficie se guarda en hectáreas (1 ha = 10.000 m²).';

create index if not exists fincas_socio on public.fincas (socio_id);
create index if not exists fincas_updated_at on public.fincas (updated_at);


-- ----------------------------------------------------------------------------
-- 4. RECINTOS SIGPAC (cada finca puede tener varios)
-- ----------------------------------------------------------------------------
create table if not exists public.recintos (
  id             uuid primary key default gen_random_uuid(),
  finca_id       uuid not null references public.fincas (id) on delete cascade,
  provincia      integer not null default 4,
  municipio      integer not null,
  agregado       integer not null default 0,
  zona           integer not null default 0,
  poligono       integer not null,
  parcela        integer not null,
  recinto        integer,
  superficie_ha  numeric(12, 4) check (superficie_ha >= 0),
  uso_sigpac     text,
  geometria      jsonb,                         -- contorno del recinto (GeoJSON, WGS84)
  eliminado      boolean not null default false,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.perfiles (id) on delete set null,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.perfiles (id) on delete set null
);

comment on table public.recintos is 'Referencias SIGPAC: provincia, municipio, agregado, zona, polígono, parcela y recinto.';

create index if not exists recintos_finca on public.recintos (finca_id);
create index if not exists recintos_updated_at on public.recintos (updated_at);
create index if not exists recintos_referencia
  on public.recintos (provincia, municipio, poligono, parcela);


-- ----------------------------------------------------------------------------
-- 5. FOTOS (el archivo se guarda en Storage, bucket «fotos»)
-- ----------------------------------------------------------------------------
create table if not exists public.fotos (
  id           uuid primary key default gen_random_uuid(),
  finca_id     uuid not null references public.fincas (id) on delete cascade,
  ruta         text not null,                   -- ruta del archivo dentro del bucket
  descripcion  text,
  tomada_en    timestamptz,
  eliminado    boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.perfiles (id) on delete set null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.perfiles (id) on delete set null
);

create index if not exists fotos_finca on public.fotos (finca_id);
create index if not exists fotos_updated_at on public.fotos (updated_at);


-- ----------------------------------------------------------------------------
-- Disparadores (se ejecutan solos al guardar)
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['socios', 'fincas', 'recintos', 'fotos'] loop
    execute format('drop trigger if exists marcar_modificado on public.%I', t);
    execute format(
      'create trigger marcar_modificado before insert or update on public.%I
         for each row execute function public.marcar_modificado()', t);
  end loop;

  foreach t in array array['socios', 'fincas'] loop
    execute format('drop trigger if exists solo_admin_elimina on public.%I', t);
    execute format(
      'create trigger solo_admin_elimina before update on public.%I
         for each row execute function public.solo_admin_elimina()', t);
  end loop;
end;
$$;

-- Al eliminar un socio se eliminan sus fincas; al eliminar una finca, sus
-- recintos y fotos.
create or replace function public.eliminar_en_cascada()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.eliminado and not old.eliminado then
    if tg_table_name = 'socios' then
      update public.fincas set eliminado = true
      where socio_id = new.id and not eliminado;
    elsif tg_table_name = 'fincas' then
      update public.recintos set eliminado = true
      where finca_id = new.id and not eliminado;
      update public.fotos set eliminado = true
      where finca_id = new.id and not eliminado;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists eliminar_en_cascada on public.socios;
create trigger eliminar_en_cascada
  after update of eliminado on public.socios
  for each row execute function public.eliminar_en_cascada();

drop trigger if exists eliminar_en_cascada on public.fincas;
create trigger eliminar_en_cascada
  after update of eliminado on public.fincas
  for each row execute function public.eliminar_en_cascada();


-- ----------------------------------------------------------------------------
-- 6. SEGURIDAD (Row Level Security)
-- ----------------------------------------------------------------------------
--   Administrador → puede hacerlo todo.
--   Técnico       → ve todo; edita socios; crea y edita fincas, recintos y
--                   fotos; borra recintos y fotos. No crea ni elimina socios
--                   ni elimina fincas.
--   Usuario desactivado o sin sesión → no ve nada.
-- ----------------------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.socios   enable row level security;
alter table public.fincas   enable row level security;
alter table public.recintos enable row level security;
alter table public.fotos    enable row level security;

revoke all on public.perfiles, public.socios, public.fincas, public.recintos, public.fotos from anon;
grant select, update on public.perfiles to authenticated;
grant select, insert, update, delete on public.socios, public.fincas, public.recintos, public.fotos to authenticated;

-- Perfiles
drop policy if exists "perfiles: ver" on public.perfiles;
create policy "perfiles: ver" on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.es_usuario_activo());

drop policy if exists "perfiles: editar" on public.perfiles;
create policy "perfiles: editar" on public.perfiles
  for update to authenticated
  using (id = auth.uid() or public.es_admin())
  with check (id = auth.uid() or public.es_admin());

-- Socios
drop policy if exists "socios: ver" on public.socios;
create policy "socios: ver" on public.socios
  for select to authenticated using (public.es_usuario_activo());

drop policy if exists "socios: crear" on public.socios;
create policy "socios: crear" on public.socios
  for insert to authenticated with check (public.es_admin());

drop policy if exists "socios: editar" on public.socios;
create policy "socios: editar" on public.socios
  for update to authenticated
  using (public.es_usuario_activo()) with check (public.es_usuario_activo());

drop policy if exists "socios: borrar" on public.socios;
create policy "socios: borrar" on public.socios
  for delete to authenticated using (public.es_admin());

-- Fincas, recintos y fotos
do $$
declare
  t text;
begin
  foreach t in array array['fincas', 'recintos', 'fotos'] loop
    execute format('drop policy if exists "%s: ver" on public.%I', t, t);
    execute format(
      'create policy "%s: ver" on public.%I for select to authenticated
         using (public.es_usuario_activo())', t, t);

    execute format('drop policy if exists "%s: crear" on public.%I', t, t);
    execute format(
      'create policy "%s: crear" on public.%I for insert to authenticated
         with check (public.es_usuario_activo())', t, t);

    execute format('drop policy if exists "%s: editar" on public.%I', t, t);
    execute format(
      'create policy "%s: editar" on public.%I for update to authenticated
         using (public.es_usuario_activo()) with check (public.es_usuario_activo())', t, t);

    execute format('drop policy if exists "%s: borrar" on public.%I', t, t);
    execute format(
      'create policy "%s: borrar" on public.%I for delete to authenticated
         using (public.es_admin())', t, t);
  end loop;
end;
$$;


-- ----------------------------------------------------------------------------
-- 7. ALMACÉN DE FOTOS (Storage)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "fotos: ver archivos" on storage.objects;
create policy "fotos: ver archivos" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos' and public.es_usuario_activo());

drop policy if exists "fotos: subir archivos" on storage.objects;
create policy "fotos: subir archivos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and public.es_usuario_activo());

drop policy if exists "fotos: borrar archivos" on storage.objects;
create policy "fotos: borrar archivos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and public.es_usuario_activo());


-- ============================================================================
--  Listo. Si ves «Success. No rows returned», todo ha ido bien.
-- ============================================================================
