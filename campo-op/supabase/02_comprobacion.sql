-- ============================================================================
-- Campo OP · Comprobación de la base de datos (solo lee, no cambia nada)
-- ----------------------------------------------------------------------------
-- Pégalo en Supabase → SQL Editor → Run, después de ejecutar 01_esquema.sql.
--
-- Debe salir una fila por cada tabla (fotos, fincas, perfiles, recintos, socios),
-- con «rls_activada = true» y al menos una política en cada una.
-- ============================================================================

select
  c.relname                                                             as tabla,
  c.relrowsecurity                                                      as rls_activada,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname)          as politicas,
  case
    when c.relrowsecurity and
         (select count(*) from pg_policies p
           where p.schemaname = 'public' and p.tablename = c.relname) > 0
    then 'OK'
    else 'REVISAR'
  end                                                                   as estado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
