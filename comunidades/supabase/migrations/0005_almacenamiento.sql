-- =====================================================================
-- Comunidad Fácil · 0005 · Almacenamiento privado de documentos
-- Ruta de cada archivo: {id_comunidad}/{carpeta}/{nombre}
-- Los archivos solo se ven con URLs firmadas de corta duración.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Leer: el administrador de la comunidad, o cualquiera que pueda ver la ficha del documento
-- (la tabla documents aplica sus propias reglas: los restringidos no los ven los propietarios).
create policy documentos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (
      public.is_admin(((storage.foldername(objects.name))[1])::uuid)
      or exists (select 1 from public.documents d where d.storage_path = objects.name)
    )
  );

create policy documentos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.is_admin(((storage.foldername(objects.name))[1])::uuid));

create policy documentos_update on storage.objects for update to authenticated
  using (bucket_id = 'documentos' and public.is_admin(((storage.foldername(objects.name))[1])::uuid));

create policy documentos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.is_admin(((storage.foldername(objects.name))[1])::uuid));
