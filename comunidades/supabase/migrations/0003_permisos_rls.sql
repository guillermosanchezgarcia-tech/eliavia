-- =====================================================================
-- Comunidad Fácil · 0003 · Permisos con Row Level Security (RLS)
--   admin      → todo en su comunidad
--   president  → lectura completa de la contabilidad de su comunidad
--   owner      → solo SUS recibos y pagos + documentos comunes no restringidos
-- =====================================================================

-- ---------- Funciones auxiliares ----------
create or replace function public.has_role(p_community uuid, p_roles public.member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
     where m.community_id = p_community and m.user_id = auth.uid() and m.role = any (p_roles)
  );
$$;

create or replace function public.is_admin(p_community uuid)
returns boolean language sql stable as $$
  select public.has_role(p_community, array['admin']::public.member_role[]);
$$;

-- Administrador o presidente: pueden ver el estado de cuentas completo
create or replace function public.can_view_accounts(p_community uuid)
returns boolean language sql stable as $$
  select public.has_role(p_community, array['admin', 'president']::public.member_role[]);
$$;

create or replace function public.is_member(p_community uuid)
returns boolean language sql stable as $$
  select public.has_role(p_community, array['admin', 'president', 'owner']::public.member_role[]);
$$;

-- Fichas de propietario vinculadas al usuario conectado
create or replace function public.my_owner_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from owners where user_id = auth.uid();
$$;

-- ---------- Activar RLS en todas las tablas ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'communities', 'memberships', 'bank_accounts', 'property_groups', 'properties',
    'property_group_members', 'owners', 'ownerships', 'suppliers', 'categories', 'allocation_keys',
    'allocation_key_weights', 'fiscal_years', 'budgets', 'budget_lines', 'receipt_counters', 'receipts',
    'receipt_lines', 'payments', 'documents', 'expenses', 'ledger_accounts', 'journal_entries',
    'journal_lines', 'audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- Perfiles ----------
create policy profiles_self_select on public.profiles for select using (id = auth.uid());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- Comunidades ----------
create policy communities_select on public.communities for select using (public.is_member(id));
create policy communities_update on public.communities for update using (public.is_admin(id)) with check (public.is_admin(id));
create policy communities_delete on public.communities for delete using (public.is_admin(id));
-- El alta se hace con la función create_community()

create policy memberships_select on public.memberships for select
  using (user_id = auth.uid() or public.is_admin(community_id));
create policy memberships_admin on public.memberships for all
  using (public.is_admin(community_id)) with check (public.is_admin(community_id));

-- ---------- Tablas de configuración: las ven todos los miembros, las edita el administrador ----------
do $$
declare
  t text;
begin
  foreach t in array array['bank_accounts', 'property_groups', 'properties', 'suppliers', 'categories', 'allocation_keys', 'fiscal_years'] loop
    execute format('create policy %I on public.%I for select using (public.is_member(community_id))', t || '_select', t);
    execute format('create policy %I on public.%I for all using (public.is_admin(community_id)) with check (public.is_admin(community_id))', t || '_admin', t);
  end loop;
end $$;

create policy property_group_members_select on public.property_group_members for select
  using (exists (select 1 from public.property_groups g where g.id = group_id and public.is_member(g.community_id)));
create policy property_group_members_admin on public.property_group_members for all
  using (exists (select 1 from public.property_groups g where g.id = group_id and public.is_admin(g.community_id)))
  with check (exists (select 1 from public.property_groups g where g.id = group_id and public.is_admin(g.community_id)));

create policy allocation_key_weights_select on public.allocation_key_weights for select
  using (exists (select 1 from public.allocation_keys k where k.id = key_id and public.is_member(k.community_id)));
create policy allocation_key_weights_admin on public.allocation_key_weights for all
  using (exists (select 1 from public.allocation_keys k where k.id = key_id and public.is_admin(k.community_id)))
  with check (exists (select 1 from public.allocation_keys k where k.id = key_id and public.is_admin(k.community_id)));

-- ---------- Propietarios: cada uno solo ve su propia ficha ----------
create policy owners_select on public.owners for select
  using (public.can_view_accounts(community_id) or user_id = auth.uid());
create policy owners_admin on public.owners for all
  using (public.is_admin(community_id)) with check (public.is_admin(community_id));

create policy ownerships_select on public.ownerships for select
  using (public.can_view_accounts(community_id) or owner_id in (select public.my_owner_ids()));
create policy ownerships_admin on public.ownerships for all
  using (public.is_admin(community_id)) with check (public.is_admin(community_id));

-- ---------- Presupuestos: los propietarios solo ven los aprobados ----------
create policy budgets_select on public.budgets for select
  using (public.can_view_accounts(community_id) or (status = 'approved' and public.is_member(community_id)));
create policy budgets_admin on public.budgets for all
  using (public.is_admin(community_id)) with check (public.is_admin(community_id));

create policy budget_lines_select on public.budget_lines for select
  using (exists (select 1 from public.budgets b where b.id = budget_id));
create policy budget_lines_admin on public.budget_lines for all
  using (exists (select 1 from public.budgets b where b.id = budget_id and public.is_admin(b.community_id)))
  with check (exists (select 1 from public.budgets b where b.id = budget_id and public.is_admin(b.community_id)));

-- ---------- Recibos y cobros: datos personales de pago ----------
create policy receipts_select on public.receipts for select
  using (public.can_view_accounts(community_id) or owner_id in (select public.my_owner_ids()));
create policy receipts_admin on public.receipts for all
  using (public.is_admin(community_id)) with check (public.is_admin(community_id));

create policy receipt_lines_select on public.receipt_lines for select
  using (exists (select 1 from public.receipts r where r.id = receipt_id));
create policy receipt_lines_admin on public.receipt_lines for all
  using (exists (select 1 from public.receipts r where r.id = receipt_id and public.is_admin(r.community_id)))
  with check (exists (select 1 from public.receipts r where r.id = receipt_id and public.is_admin(r.community_id)));

create policy payments_select on public.payments for select
  using (public.can_view_accounts(community_id) or owner_id in (select public.my_owner_ids()));
create policy payments_admin on public.payments for all
  using (public.is_admin(community_id)) with check (public.is_admin(community_id));

-- ---------- Facturas y documentos: comunes salvo los restringidos ----------
create policy documents_select on public.documents for select
  using (public.can_view_accounts(community_id) or (not restricted and public.is_member(community_id)));
create policy documents_admin on public.documents for all
  using (public.is_admin(community_id)) with check (public.is_admin(community_id));

create policy expenses_select on public.expenses for select
  using (public.can_view_accounts(community_id) or (not restricted and public.is_member(community_id)));
create policy expenses_admin on public.expenses for all
  using (public.is_admin(community_id)) with check (public.is_admin(community_id));

-- ---------- Contabilidad interna: solo administrador y presidente (lectura) ----------
create policy ledger_accounts_select on public.ledger_accounts for select using (auth.uid() is not null);
create policy journal_entries_select on public.journal_entries for select using (public.can_view_accounts(community_id));
create policy journal_lines_select on public.journal_lines for select using (public.can_view_accounts(community_id));
create policy audit_log_select on public.audit_log for select using (public.is_admin(community_id));
-- receipt_counters: sin políticas → nadie accede directamente (solo el trigger de numeración)

-- ---------- Privilegios ----------
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Funciones internas: no se pueden llamar desde la API
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.handle_new_user()', 'public.fiscal_year_for(uuid, date)', 'public.assert_fiscal_year_open(uuid)',
    'public.tg_set_fiscal_year()', 'public.tg_journal_guard()', 'public.tg_receipt_number()',
    'public.tg_ownership_no_overlap()', 'public.post_receipt(uuid)', 'public.post_payment(uuid)',
    'public.post_expense(uuid)', 'public.tg_post_ledger()', 'public.tg_audit()', 'public.init_community(uuid, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

revoke execute on function public.create_community(text, text, text, text, text, text, text, numeric) from public, anon;
grant execute on function public.create_community(text, text, text, text, text, text, text, numeric) to authenticated;
revoke execute on function public.transfer_property(uuid, uuid, date) from public, anon;
grant execute on function public.transfer_property(uuid, uuid, date) to authenticated;
