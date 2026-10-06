-- =====================================================================
-- Comunidad Fácil · 0004 · Vistas, informes y emisión de recibos
-- =====================================================================

-- ---------- Recibos con importe cobrado ----------
-- Los cobros de cada propietario se aplican a sus recibos por orden de vencimiento (el más antiguo primero).
-- La vista respeta los permisos RLS de quien consulta (security_invoker).
create or replace view public.v_receipts with (security_invoker = true) as
with paid as (
  select owner_id, sum(amount_cents)::bigint as total
    from public.payments
   where owner_id is not null
   group by owner_id
), ordered as (
  select r.*,
         coalesce(sum(r.amount_cents) over (
           partition by r.owner_id order by r.due_date, r.code
           rows between unbounded preceding and 1 preceding), 0)::bigint as cum_before
    from public.receipts r
   where r.status = 'issued'
)
select o.id, o.community_id, o.fiscal_year_id, o.budget_id, o.installment, o.number, o.code,
       o.property_id, o.owner_id, o.concept, o.issue_date, o.due_date, o.amount_cents, o.status,
       least(o.amount_cents, greatest(0, coalesce(p.total, 0) - o.cum_before))::bigint as paid_cents
  from ordered o left join paid p on p.owner_id = o.owner_id
union all
select r.id, r.community_id, r.fiscal_year_id, r.budget_id, r.installment, r.number, r.code,
       r.property_id, r.owner_id, r.concept, r.issue_date, r.due_date, r.amount_cents, r.status,
       0::bigint as paid_cents
  from public.receipts r
 where r.status = 'cancelled';

-- ---------- Saldo de cada propietario ----------
-- balance_cents > 0 → debe dinero; < 0 → tiene saldo a favor.
create or replace view public.v_owner_balances with (security_invoker = true) as
select o.id as owner_id,
       o.community_id,
       o.full_name,
       o.nif,
       coalesce(rc.charged, 0)::bigint as charged_cents,
       coalesce(pm.paid, 0)::bigint as paid_cents,
       (coalesce(rc.charged, 0) - coalesce(pm.paid, 0))::bigint as balance_cents,
       coalesce(od.overdue, 0)::bigint as overdue_cents,
       od.oldest_due_date
  from public.owners o
  left join (select owner_id, sum(amount_cents) as charged from public.receipts where status = 'issued' group by owner_id) rc
    on rc.owner_id = o.id
  left join (select owner_id, sum(amount_cents) as paid from public.payments where owner_id is not null group by owner_id) pm
    on pm.owner_id = o.id
  left join (
    select owner_id, sum(amount_cents - paid_cents) as overdue, min(due_date) as oldest_due_date
      from public.v_receipts
     where status = 'issued' and paid_cents < amount_cents and due_date < current_date
     group by owner_id
  ) od on od.owner_id = o.id;

revoke all on public.v_receipts, public.v_owner_balances from anon;
grant select on public.v_receipts, public.v_owner_balances to authenticated;

-- ---------- Informe de ingresos y gastos por partida y periodo ----------
-- Devuelve importes agregados (sin datos personales): lo pueden consultar todos los miembros.
--   section: income (ingresos), expense (gastos), reserve_in (aportaciones al fondo), reserve_out (pagos con cargo al fondo)
create or replace function public.ledger_summary(p_community uuid, p_from date, p_to date, p_grain text default 'year')
returns table (period_start date, section text, category_id uuid, category_code text, category_name text, amount_cents bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_member(p_community) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_grain not in ('month', 'quarter', 'year') then
    raise exception 'Agrupación no válida';
  end if;
  return query
  select date_trunc(p_grain, e.entry_date)::date as period_start,
         case
           when l.account_code = '700' then 'income'
           when l.account_code = '600' then 'expense'
           when l.account_code = '113' and l.credit_cents > 0 then 'reserve_in'
           else 'reserve_out'
         end as section,
         c.id, c.code, c.name,
         sum(case when l.account_code = '700' then l.credit_cents - l.debit_cents
                  when l.account_code = '600' then l.debit_cents - l.credit_cents
                  when l.credit_cents > 0 then l.credit_cents
                  else l.debit_cents end)::bigint as amount_cents
    from journal_lines l
    join journal_entries e on e.id = l.entry_id
    left join categories c on c.id = l.category_id
   where l.community_id = p_community
     and l.account_code in ('600', '700', '113')
     and e.source_type <> 'opening'
     and e.entry_date between p_from and p_to
   group by 1, 2, c.id, c.code, c.name
   order by 1, 2, c.code;
end $$;

-- ---------- Fondo de reserva ----------
-- Mínimo legal: % configurable (10 % por defecto; 5 % en Cataluña) del último presupuesto ordinario aprobado,
-- calculado sobre los gastos presupuestados (sin contar la propia aportación al fondo).
create or replace function public.reserve_fund_status(p_community uuid)
returns table (balance_cents bigint, minimum_cents bigint, base_budget_cents bigint, pct numeric,
               budget_id uuid, budget_name text, shortfall_cents bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_balance bigint;
  v_pct numeric;
  v_budget uuid;
  v_name text;
  v_base bigint;
  v_min bigint;
begin
  if not is_member(p_community) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select coalesce(sum(credit_cents - debit_cents), 0) into v_balance
    from journal_lines where community_id = p_community and account_code = '113';
  select reserve_fund_pct into v_pct from communities where id = p_community;

  select b.id, b.name into v_budget, v_name
    from budgets b left join fiscal_years f on f.id = b.fiscal_year_id
   where b.community_id = p_community and b.kind = 'ordinary' and b.status = 'approved'
   order by f.start_date desc nulls last, b.first_due_date desc, b.approved_at desc nulls last
   limit 1;

  select coalesce(sum(bl.amount_cents), 0) into v_base
    from budget_lines bl join categories c on c.id = bl.category_id
   where bl.budget_id = v_budget and c.kind <> 'reserve';

  v_min := round(v_base * v_pct / 100);
  return query select v_balance, v_min, v_base, v_pct, v_budget, v_name, greatest(0, v_min - v_balance);
end $$;

-- Evolución mensual del fondo de reserva (entradas, salidas y saldo acumulado)
create or replace function public.reserve_fund_evolution(p_community uuid)
returns table (month date, in_cents bigint, out_cents bigint, balance_cents bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_member(p_community) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
  with m as (
    select date_trunc('month', e.entry_date)::date as month,
           sum(l.credit_cents)::bigint as in_cents,
           sum(l.debit_cents)::bigint as out_cents
      from journal_lines l join journal_entries e on e.id = l.entry_id
     where l.community_id = p_community and l.account_code = '113'
     group by 1
  )
  select m.month, m.in_cents, m.out_cents,
         sum(m.in_cents - m.out_cents) over (order by m.month)::bigint
    from m order by m.month;
end $$;

-- ---------- Presupuesto frente a gasto real ----------
create or replace function public.budget_vs_actual(p_budget uuid)
returns table (category_id uuid, category_code text, category_name text, category_kind public.category_kind,
               budget_cents bigint, actual_cents bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  b budgets%rowtype;
  v_from date;
  v_to date;
begin
  select * into b from budgets where id = p_budget;
  if not found or not (can_view_accounts(b.community_id) or (b.status = 'approved' and is_member(b.community_id))) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select start_date, end_date into v_from, v_to from fiscal_years where id = b.fiscal_year_id;
  if v_from is null then
    v_from := make_date(extract(year from b.first_due_date)::int, 1, 1);
    v_to := make_date(extract(year from b.first_due_date)::int, 12, 31);
  end if;

  return query
  with budgeted as (
    select bl.category_id, sum(bl.amount_cents)::bigint as amount
      from budget_lines bl where bl.budget_id = p_budget group by bl.category_id
  ), actual as (
    select l.category_id,
           sum(case when l.account_code = '600' then l.debit_cents - l.credit_cents
                    when l.account_code = '113' then l.credit_cents
                    else 0 end)::bigint as amount
      from journal_lines l join journal_entries e on e.id = l.entry_id
     where l.community_id = b.community_id
       and e.entry_date between v_from and v_to
       and e.source_type in ('expense', 'receipt')
       and (l.account_code = '600' or (l.account_code = '113' and e.source_type = 'receipt'))
     group by l.category_id
  )
  select c.id, c.code, c.name, c.kind, coalesce(bu.amount, 0)::bigint, coalesce(a.amount, 0)::bigint
    from categories c
    left join budgeted bu on bu.category_id = c.id
    left join actual a on a.category_id = c.id
   where c.community_id = b.community_id
     and (bu.amount is not null or a.amount is not null)
     and c.kind in ('expense', 'reserve')
   order by c.sort_order, c.code;
end $$;

-- ---------- Tesorería: saldo de cada cuenta bancaria y de caja ----------
create or replace function public.bank_balances(p_community uuid)
returns table (bank_account_id uuid, name text, iban text, is_cash boolean, balance_cents bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not can_view_accounts(p_community) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
  select a.id, a.name, a.iban, a.is_cash,
         coalesce(sum(l.debit_cents - l.credit_cents), 0)::bigint
    from bank_accounts a
    left join journal_lines l on l.bank_account_id = a.id and l.account_code in ('570', '572')
   where a.community_id = p_community
   group by a.id, a.name, a.iban, a.is_cash
   order by a.is_cash, a.name;
end $$;

-- ---------- Emisión de recibos ----------
-- Recibe una lista JSON de recibos ya calculados (el reparto se calcula en la aplicación)
-- y los inserta en una sola transacción con numeración correlativa.
create or replace function public.create_receipts(p_community uuid, p_receipts jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare
  r jsonb;
  l jsonb;
  v_id uuid;
  v_total bigint;
  v_count int := 0;
begin
  if not is_admin(p_community) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  for r in select * from jsonb_array_elements(p_receipts) loop
    select coalesce(sum((x ->> 'amount_cents')::bigint), 0) into v_total
      from jsonb_array_elements(r -> 'lines') x;
    insert into receipts (community_id, budget_id, installment, property_id, owner_id, concept, issue_date, due_date, amount_cents)
    values (p_community, nullif(r ->> 'budget_id', '')::uuid, (r ->> 'installment')::int,
            (r ->> 'property_id')::uuid, (r ->> 'owner_id')::uuid, r ->> 'concept',
            (r ->> 'issue_date')::date, (r ->> 'due_date')::date, v_total)
    returning id into v_id;
    for l in select * from jsonb_array_elements(r -> 'lines') loop
      insert into receipt_lines (receipt_id, category_id, budget_line_id, amount_cents)
      values (v_id, (l ->> 'category_id')::uuid, nullif(l ->> 'budget_line_id', '')::uuid, (l ->> 'amount_cents')::bigint);
    end loop;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.ledger_summary(uuid, date, date, text)', 'public.reserve_fund_status(uuid)',
    'public.reserve_fund_evolution(uuid)', 'public.budget_vs_actual(uuid)', 'public.bank_balances(uuid)',
    'public.create_receipts(uuid, jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------- Usuarios con acceso a la comunidad (para el administrador) ----------
create or replace function public.community_members(p_community uuid)
returns table (user_id uuid, email text, role public.member_role)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin(p_community) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
  select m.user_id, p.email, m.role
    from memberships m left join profiles p on p.id = m.user_id
   where m.community_id = p_community
   order by m.role, p.email;
end $$;

revoke execute on function public.community_members(uuid) from public, anon;
grant execute on function public.community_members(uuid) to authenticated;
