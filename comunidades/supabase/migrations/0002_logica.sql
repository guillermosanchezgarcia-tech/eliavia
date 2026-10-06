-- =====================================================================
-- Comunidad Fácil · 0002 · Lógica: ejercicios, numeración, contabilidad
-- de partida doble, auditoría y alta de comunidades
-- =====================================================================

-- ---------- Perfil automático al crear un usuario ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Ejercicios contables ----------
-- Devuelve (y crea si no existe) el ejercicio que contiene una fecha.
create or replace function public.fiscal_year_for(p_community uuid, p_date date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_start_month int;
  v_start date;
begin
  select id into v_id from fiscal_years
   where community_id = p_community and p_date between start_date and end_date;
  if v_id is not null then
    return v_id;
  end if;

  select fiscal_year_start_month into v_start_month from communities where id = p_community;
  if v_start_month is null then
    raise exception 'Comunidad no encontrada';
  end if;
  v_start := make_date(extract(year from p_date)::int, v_start_month, 1);
  if v_start > p_date then
    v_start := (v_start - interval '1 year')::date;
  end if;

  insert into fiscal_years (community_id, year, start_date, end_date)
  values (p_community, extract(year from v_start)::int, v_start, (v_start + interval '1 year' - interval '1 day')::date)
  on conflict (community_id, year) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from fiscal_years
     where community_id = p_community and year = extract(year from v_start)::int;
  end if;
  return v_id;
end $$;

create or replace function public.assert_fiscal_year_open(p_fiscal_year uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_year int;
begin
  select year into v_year from fiscal_years where id = p_fiscal_year and status = 'closed';
  if v_year is not null then
    raise exception 'El ejercicio % está cerrado: no se puede modificar. Las correcciones se hacen con un asiento de rectificación.', v_year
      using errcode = 'P0001';
  end if;
end $$;

-- Asigna el ejercicio a recibos, cobros y gastos, y bloquea los ejercicios cerrados.
create or replace function public.tg_set_fiscal_year()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_date date;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.fiscal_year_id is not null then
    perform assert_fiscal_year_open(old.fiscal_year_id);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;

  v_date := (to_jsonb(new) ->> case tg_table_name
    when 'receipts' then 'issue_date'
    when 'payments' then 'payment_date'
    when 'expenses' then 'invoice_date'
  end)::date;
  new.fiscal_year_id := fiscal_year_for(new.community_id, v_date);
  perform assert_fiscal_year_open(new.fiscal_year_id);
  return new;
end $$;

create trigger receipts_fiscal_year before insert or update or delete on public.receipts
  for each row execute function public.tg_set_fiscal_year();
create trigger payments_fiscal_year before insert or update or delete on public.payments
  for each row execute function public.tg_set_fiscal_year();
create trigger expenses_fiscal_year before insert or update or delete on public.expenses
  for each row execute function public.tg_set_fiscal_year();

-- Ningún asiento de un ejercicio cerrado puede crearse ni borrarse.
create or replace function public.tg_journal_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform assert_fiscal_year_open(old.fiscal_year_id);
    return old;
  end if;
  if tg_op = 'UPDATE' then
    perform assert_fiscal_year_open(old.fiscal_year_id);
  end if;
  perform assert_fiscal_year_open(new.fiscal_year_id);
  return new;
end $$;

create trigger journal_entries_guard before insert or update or delete on public.journal_entries
  for each row execute function public.tg_journal_guard();

-- ---------- Numeración correlativa de recibos (por comunidad y ejercicio) ----------
create or replace function public.tg_receipt_number()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_year int;
begin
  if new.number is null then
    select year into v_year from fiscal_years where id = new.fiscal_year_id;
    insert into receipt_counters (community_id, year, last_number)
    values (new.community_id, v_year, 1)
    on conflict (community_id, year) do update set last_number = receipt_counters.last_number + 1
    returning last_number into new.number;
    new.code := v_year::text || '/' || lpad(new.number::text, 5, '0');
  end if;
  return new;
end $$;

-- Se ejecuta después de receipts_fiscal_year (los triggers BEFORE van por orden alfabético).
create trigger receipts_number before insert on public.receipts
  for each row execute function public.tg_receipt_number();

-- ---------- Titulares: sin solapes de fechas en un mismo inmueble ----------
create or replace function public.tg_ownership_no_overlap()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (
    select 1 from ownerships o
     where o.property_id = new.property_id
       and o.id <> new.id
       and daterange(o.start_date, coalesce(o.end_date, 'infinity'::date), '[]')
           && daterange(new.start_date, coalesce(new.end_date, 'infinity'::date), '[]')
  ) then
    raise exception 'Las fechas de titularidad se solapan con otro titular del mismo inmueble';
  end if;
  return new;
end $$;

create trigger ownerships_no_overlap before insert or update on public.ownerships
  for each row execute function public.tg_ownership_no_overlap();

-- Cambio de titular: cierra la titularidad vigente el día anterior y abre la nueva.
create or replace function public.transfer_property(p_property uuid, p_owner uuid, p_date date)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_community uuid;
  v_id uuid;
begin
  select community_id into v_community from properties where id = p_property;
  if v_community is null or not public.is_admin(v_community) then
    raise exception 'No autorizado';
  end if;
  update ownerships set end_date = p_date - 1
   where property_id = p_property and end_date is null and start_date < p_date;
  insert into ownerships (community_id, property_id, owner_id, start_date)
  values (v_community, p_property, p_owner, p_date)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- Contabilidad de partida doble ----------
-- Cada recibo, cobro o gasto genera automáticamente su asiento (debe = haber).
create or replace function public.post_receipt(p_receipt uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r receipts%rowtype;
  v_total bigint;
  v_entry uuid;
begin
  delete from journal_entries where source_type = 'receipt' and source_id = p_receipt;
  select * into r from receipts where id = p_receipt;
  if not found or r.status = 'cancelled' then
    return;
  end if;
  select coalesce(sum(amount_cents), 0) into v_total from receipt_lines where receipt_id = p_receipt;
  if v_total = 0 then
    return;
  end if;

  insert into journal_entries (community_id, fiscal_year_id, entry_date, description, source_type, source_id)
  values (r.community_id, fiscal_year_for(r.community_id, r.issue_date), r.issue_date,
          'Recibo ' || coalesce(r.code, '') || ' · ' || r.concept, 'receipt', p_receipt)
  returning id into v_entry;

  insert into journal_lines (entry_id, community_id, account_code, debit_cents, owner_id)
  values (v_entry, r.community_id, '430', v_total, r.owner_id);

  insert into journal_lines (entry_id, community_id, account_code, credit_cents, category_id)
  select v_entry, r.community_id,
         case when c.kind = 'reserve' then '113' else '700' end,
         sum(rl.amount_cents), rl.category_id
    from receipt_lines rl join categories c on c.id = rl.category_id
   where rl.receipt_id = p_receipt
   group by rl.category_id, c.kind
  having sum(rl.amount_cents) > 0;
end $$;

create or replace function public.post_payment(p_payment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p payments%rowtype;
  v_entry uuid;
  v_cash boolean;
  v_kind category_kind;
  v_desc text;
begin
  delete from journal_entries where source_type = 'payment' and source_id = p_payment;
  select * into p from payments where id = p_payment;
  if not found then
    return;
  end if;
  select is_cash into v_cash from bank_accounts where id = p.bank_account_id;

  if p.owner_id is not null then
    select 'Cobro de ' || full_name into v_desc from owners where id = p.owner_id;
  else
    select kind, name into v_kind, v_desc from categories where id = p.category_id;
  end if;

  insert into journal_entries (community_id, fiscal_year_id, entry_date, description, source_type, source_id)
  values (p.community_id, fiscal_year_for(p.community_id, p.payment_date), p.payment_date,
          coalesce(v_desc, 'Cobro') || coalesce(' · ' || p.reference, ''), 'payment', p_payment)
  returning id into v_entry;

  insert into journal_lines (entry_id, community_id, account_code, debit_cents, bank_account_id)
  values (v_entry, p.community_id, case when v_cash then '570' else '572' end, p.amount_cents, p.bank_account_id);

  if p.owner_id is not null then
    insert into journal_lines (entry_id, community_id, account_code, credit_cents, owner_id)
    values (v_entry, p.community_id, '430', p.amount_cents, p.owner_id);
  else
    insert into journal_lines (entry_id, community_id, account_code, credit_cents, category_id)
    values (v_entry, p.community_id, case when v_kind = 'reserve' then '113' else '700' end, p.amount_cents, p.category_id);
  end if;
end $$;

create or replace function public.post_expense(p_expense uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  e expenses%rowtype;
  v_entry uuid;
  v_cash boolean;
  v_desc text;
begin
  delete from journal_entries where source_type in ('expense', 'expense_payment') and source_id = p_expense;
  select * into e from expenses where id = p_expense;
  if not found or e.total_cents = 0 then
    return;
  end if;
  select coalesce(s.name || ' · ', '') || coalesce('Fra. ' || e.invoice_number || ' · ', '') || coalesce(e.description, c.name)
    into v_desc
    from categories c left join suppliers s on s.id = e.supplier_id
   where c.id = e.category_id;

  -- Asiento de la factura: gasto (o uso del fondo de reserva) contra proveedor y retenciones
  insert into journal_entries (community_id, fiscal_year_id, entry_date, description, source_type, source_id)
  values (e.community_id, fiscal_year_for(e.community_id, e.invoice_date), e.invoice_date, v_desc, 'expense', p_expense)
  returning id into v_entry;

  insert into journal_lines (entry_id, community_id, account_code, debit_cents, category_id, supplier_id)
  values (v_entry, e.community_id, case when e.charged_to_reserve then '113' else '600' end, e.total_cents, e.category_id, e.supplier_id);
  insert into journal_lines (entry_id, community_id, account_code, credit_cents, supplier_id)
  values (v_entry, e.community_id, '400', e.payable_cents, e.supplier_id);
  if e.irpf_cents > 0 then
    insert into journal_lines (entry_id, community_id, account_code, credit_cents, supplier_id)
    values (v_entry, e.community_id, '4751', e.irpf_cents, e.supplier_id);
  end if;

  -- Asiento del pago al proveedor
  if e.paid_date is not null and e.payable_cents > 0 then
    select is_cash into v_cash from bank_accounts where id = e.paid_bank_account_id;
    insert into journal_entries (community_id, fiscal_year_id, entry_date, description, source_type, source_id)
    values (e.community_id, fiscal_year_for(e.community_id, e.paid_date), e.paid_date, 'Pago · ' || v_desc, 'expense_payment', p_expense)
    returning id into v_entry;
    insert into journal_lines (entry_id, community_id, account_code, debit_cents, supplier_id)
    values (v_entry, e.community_id, '400', e.payable_cents, e.supplier_id);
    insert into journal_lines (entry_id, community_id, account_code, credit_cents, bank_account_id)
    values (v_entry, e.community_id, case when v_cash then '570' else '572' end, e.payable_cents, e.paid_bank_account_id);
  end if;
end $$;

create or replace function public.tg_post_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'receipts' then
    if tg_op = 'DELETE' then
      delete from journal_entries where source_type = 'receipt' and source_id = old.id;
    else
      perform post_receipt(new.id);
    end if;
  elsif tg_table_name = 'receipt_lines' then
    perform post_receipt(coalesce(new.receipt_id, old.receipt_id));
  elsif tg_table_name = 'payments' then
    if tg_op = 'DELETE' then
      delete from journal_entries where source_type = 'payment' and source_id = old.id;
    else
      perform post_payment(new.id);
    end if;
  elsif tg_table_name = 'expenses' then
    if tg_op = 'DELETE' then
      delete from journal_entries where source_type in ('expense', 'expense_payment') and source_id = old.id;
    else
      perform post_expense(new.id);
    end if;
  end if;
  return null;
end $$;

create trigger receipts_ledger after insert or update or delete on public.receipts
  for each row execute function public.tg_post_ledger();
create trigger receipt_lines_ledger after insert or update or delete on public.receipt_lines
  for each row execute function public.tg_post_ledger();
create trigger payments_ledger after insert or update or delete on public.payments
  for each row execute function public.tg_post_ledger();
create trigger expenses_ledger after insert or update or delete on public.expenses
  for each row execute function public.tg_post_ledger();

-- ---------- Registro de auditoría ----------
create or replace function public.tg_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_community uuid;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  v_row := coalesce(v_new, v_old);

  if tg_table_name = 'communities' then
    v_community := (v_row ->> 'id')::uuid;
  elsif tg_table_name = 'budget_lines' then
    select community_id into v_community from budgets where id = (v_row ->> 'budget_id')::uuid;
  else
    v_community := (v_row ->> 'community_id')::uuid;
  end if;

  insert into audit_log (community_id, table_name, record_id, action, user_id, old_data, new_data)
  values (v_community, tg_table_name, (v_row ->> 'id')::uuid, tg_op, auth.uid(), v_old, v_new);
  return null;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'communities', 'memberships', 'bank_accounts', 'properties', 'owners', 'ownerships', 'suppliers',
    'categories', 'allocation_keys', 'budgets', 'budget_lines', 'receipts', 'payments', 'expenses', 'documents'
  ] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.tg_audit()',
                   t || '_audit', t);
  end loop;
end $$;

-- ---------- Alta de comunidades ----------
create or replace function public.init_community(p_community uuid, p_admin uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_admin is not null then
    insert into memberships (community_id, user_id, role) values (p_community, p_admin, 'admin')
    on conflict do nothing;
  end if;

  insert into categories (community_id, code, name, kind, is_system, sort_order) values
    (p_community, 'G01', 'Limpieza', 'expense', false, 1),
    (p_community, 'G02', 'Ascensor', 'expense', false, 2),
    (p_community, 'G03', 'Electricidad', 'expense', false, 3),
    (p_community, 'G04', 'Agua', 'expense', false, 4),
    (p_community, 'G05', 'Seguro', 'expense', false, 5),
    (p_community, 'G06', 'Administración', 'expense', false, 6),
    (p_community, 'G07', 'Mantenimiento', 'expense', false, 7),
    (p_community, 'G08', 'Jardinería', 'expense', false, 8),
    (p_community, 'G09', 'Piscina', 'expense', false, 9),
    (p_community, 'G10', 'Reparaciones', 'expense', false, 10),
    (p_community, 'G11', 'Portería y conserjería', 'expense', false, 11),
    (p_community, 'G12', 'Gastos bancarios', 'expense', false, 12),
    (p_community, 'G13', 'Asesoría jurídica', 'expense', false, 13),
    (p_community, 'G99', 'Otros gastos', 'expense', false, 99),
    (p_community, 'I01', 'Cuotas ordinarias', 'income', true, 101),
    (p_community, 'I02', 'Derramas', 'income', true, 102),
    (p_community, 'I03', 'Ingresos por alquileres', 'income', false, 103),
    (p_community, 'I04', 'Intereses bancarios', 'income', false, 104),
    (p_community, 'I05', 'Subvenciones', 'income', false, 105),
    (p_community, 'I99', 'Otros ingresos', 'income', false, 199),
    (p_community, 'R01', 'Fondo de reserva', 'reserve', true, 201)
  on conflict do nothing;

  insert into allocation_keys (community_id, name, method, is_default)
  values (p_community, 'Coeficiente general', 'coefficient', true)
  on conflict do nothing;

  perform fiscal_year_for(p_community, current_date);
end $$;

create or replace function public.create_community(
  p_name text, p_cif text default null, p_address text default null, p_postal_code text default null,
  p_city text default null, p_province text default null, p_region text default null,
  p_reserve_fund_pct numeric default 10
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;
  insert into communities (name, cif, address, postal_code, city, province, region, reserve_fund_pct, created_by)
  values (p_name, p_cif, p_address, p_postal_code, p_city, p_province, p_region, p_reserve_fund_pct, auth.uid())
  returning id into v_id;
  perform init_community(v_id, auth.uid());
  return v_id;
end $$;
