-- =====================================================================
-- Comunidad Fácil · 0001 · Esquema base
-- Todos los importes se guardan en CÉNTIMOS (bigint). Nunca decimales.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type public.member_role as enum ('admin', 'president', 'owner');
create type public.property_kind as enum ('vivienda', 'local', 'garaje', 'trastero', 'otro');
create type public.category_kind as enum ('expense', 'income', 'reserve');
create type public.allocation_method as enum ('coefficient', 'equal', 'custom');
create type public.budget_kind as enum ('ordinary', 'extraordinary');
create type public.budget_status as enum ('draft', 'approved');
create type public.receipt_status as enum ('issued', 'cancelled');
create type public.payment_method as enum ('transferencia', 'domiciliacion', 'efectivo', 'bizum', 'otro');
create type public.doc_kind as enum ('factura', 'acta', 'estatutos', 'seguro', 'contrato', 'presupuesto', 'cuentas', 'aviso', 'otro');

-- ---------- Perfiles de usuario ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Comunidades ----------
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cif text,
  address text,
  postal_code text,
  city text,
  province text,
  region text,
  reserve_fund_pct numeric(5, 2) not null default 10 check (reserve_fund_pct >= 0 and reserve_fund_pct <= 100),
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  secretary_name text,
  privacy_policy text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  unique (community_id, user_id, role)
);
create index on public.memberships (user_id);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  name text not null,
  iban text,
  is_cash boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.bank_accounts (community_id);

-- ---------- Inmuebles ----------
create table public.property_groups (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  name text not null,
  unique (community_id, name)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  kind public.property_kind not null default 'vivienda',
  code text not null,
  description text,
  coefficient numeric(9, 4) not null check (coefficient >= 0 and coefficient <= 100),
  -- Art. 17.12 LPH (LO 1/2025): incremento acordado en junta para uso turístico, máximo 20 %
  tourist_use boolean not null default false,
  tourist_surcharge_pct numeric(5, 2) not null default 0 check (tourist_surcharge_pct >= 0 and tourist_surcharge_pct <= 20),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (community_id, code)
);
create index on public.properties (community_id);

create table public.property_group_members (
  group_id uuid not null references public.property_groups (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  primary key (group_id, property_id)
);

-- ---------- Propietarios ----------
create table public.owners (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  full_name text not null,
  nif text,
  email text,
  phone text,
  iban text,
  address text,
  notes text,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (community_id, user_id)
);
create index on public.owners (community_id);
create index on public.owners (user_id);

-- Histórico de titulares: un inmueble tiene un titular en cada fecha.
create table public.ownerships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references public.owners (id),
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index on public.ownerships (property_id);
create index on public.ownerships (owner_id);

-- ---------- Proveedores ----------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  name text not null,
  nif text,
  category text,
  iban text,
  email text,
  phone text,
  applies_withholding boolean not null default false,
  withholding_pct numeric(5, 2) not null default 15,
  -- Suministros de agua, luz y combustible: excluidos del modelo 347
  is_utility boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.suppliers (community_id);

-- ---------- Plan de partidas ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  code text not null,
  name text not null,
  kind public.category_kind not null,
  is_system boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  unique (community_id, code)
);

-- ---------- Repartos ----------
create table public.allocation_keys (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  name text not null,
  method public.allocation_method not null default 'coefficient',
  -- Si se indica, el reparto solo afecta a los inmuebles de ese grupo
  group_id uuid references public.property_groups (id),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (community_id, name)
);

create table public.allocation_key_weights (
  key_id uuid not null references public.allocation_keys (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  weight numeric(12, 4) not null check (weight >= 0),
  primary key (key_id, property_id)
);

-- ---------- Ejercicios ----------
create table public.fiscal_years (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  year int not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  unique (community_id, year)
);

-- ---------- Presupuestos y derramas ----------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  fiscal_year_id uuid references public.fiscal_years (id),
  kind public.budget_kind not null default 'ordinary',
  name text not null,
  status public.budget_status not null default 'draft',
  approved_at date,
  installments int not null default 12 check (installments between 1 and 60),
  interval_months int not null default 1 check (interval_months between 1 and 12),
  first_due_date date not null,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.budgets (community_id);

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  allocation_key_id uuid not null references public.allocation_keys (id),
  amount_cents bigint not null check (amount_cents >= 0),
  description text
);
create index on public.budget_lines (budget_id);

-- ---------- Recibos ----------
create table public.receipt_counters (
  community_id uuid not null references public.communities (id) on delete cascade,
  year int not null,
  last_number int not null default 0,
  primary key (community_id, year)
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  fiscal_year_id uuid references public.fiscal_years (id),
  budget_id uuid references public.budgets (id),
  installment int,
  number int,
  code text,
  property_id uuid not null references public.properties (id),
  owner_id uuid not null references public.owners (id),
  concept text not null,
  issue_date date not null,
  due_date date not null,
  amount_cents bigint not null check (amount_cents >= 0),
  status public.receipt_status not null default 'issued',
  created_at timestamptz not null default now(),
  unique (community_id, code),
  unique (budget_id, installment, property_id)
);
create index on public.receipts (community_id);
create index on public.receipts (owner_id);

create table public.receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  budget_line_id uuid references public.budget_lines (id) on delete set null,
  amount_cents bigint not null check (amount_cents >= 0)
);
create index on public.receipt_lines (receipt_id);

-- ---------- Cobros ----------
-- Un cobro es de un propietario (paga recibos) o es otro ingreso de la comunidad (alquiler, intereses...)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  fiscal_year_id uuid references public.fiscal_years (id),
  owner_id uuid references public.owners (id),
  category_id uuid references public.categories (id),
  payment_date date not null,
  amount_cents bigint not null check (amount_cents > 0),
  method public.payment_method not null default 'transferencia',
  bank_account_id uuid not null references public.bank_accounts (id),
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  check ((owner_id is null) <> (category_id is null))
);
create index on public.payments (community_id);
create index on public.payments (owner_id);

-- ---------- Documentos (facturas escaneadas, actas, estatutos...) ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  kind public.doc_kind not null default 'otro',
  title text not null,
  doc_date date,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  -- Restringido: no lo ven los propietarios (p. ej. contiene datos de un deudor)
  restricted boolean not null default false,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.documents (community_id);

-- ---------- Gastos / facturas ----------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  fiscal_year_id uuid references public.fiscal_years (id),
  supplier_id uuid references public.suppliers (id),
  category_id uuid not null references public.categories (id),
  allocation_key_id uuid references public.allocation_keys (id),
  invoice_number text,
  invoice_date date not null,
  description text,
  base_cents bigint not null default 0,
  vat_pct numeric(5, 2) not null default 21,
  vat_cents bigint not null default 0,
  irpf_pct numeric(5, 2) not null default 0,
  irpf_cents bigint not null default 0 check (irpf_cents >= 0),
  total_cents bigint not null,
  payable_cents bigint generated always as (total_cents - irpf_cents) stored,
  charged_to_reserve boolean not null default false,
  paid_date date,
  paid_bank_account_id uuid references public.bank_accounts (id),
  restricted boolean not null default false,
  document_id uuid references public.documents (id) on delete set null,
  created_at timestamptz not null default now(),
  check (total_cents = base_cents + vat_cents),
  check (total_cents >= 0),
  check (paid_date is null or paid_bank_account_id is not null)
);
create index on public.expenses (community_id);

-- ---------- Contabilidad de partida doble ----------
create table public.ledger_accounts (
  code text primary key,
  name text not null,
  type text not null check (type in ('asset', 'liability', 'equity', 'income', 'expense'))
);

insert into public.ledger_accounts (code, name, type) values
  ('113', 'Fondo de reserva', 'equity'),
  ('120', 'Remanente de ejercicios anteriores', 'equity'),
  ('400', 'Proveedores', 'liability'),
  ('430', 'Propietarios', 'asset'),
  ('4751', 'Hacienda Pública, acreedora por retenciones', 'liability'),
  ('570', 'Caja', 'asset'),
  ('572', 'Bancos', 'asset'),
  ('600', 'Gastos de la comunidad', 'expense'),
  ('700', 'Ingresos de la comunidad', 'income');

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  fiscal_year_id uuid not null references public.fiscal_years (id),
  entry_date date not null,
  description text not null,
  source_type text not null check (source_type in ('receipt', 'payment', 'expense', 'expense_payment', 'opening', 'manual', 'rectification')),
  source_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index on public.journal_entries (community_id, entry_date);
create index on public.journal_entries (source_type, source_id);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  account_code text not null references public.ledger_accounts (code),
  debit_cents bigint not null default 0 check (debit_cents >= 0),
  credit_cents bigint not null default 0 check (credit_cents >= 0),
  category_id uuid references public.categories (id),
  owner_id uuid references public.owners (id),
  supplier_id uuid references public.suppliers (id),
  bank_account_id uuid references public.bank_accounts (id),
  check ((debit_cents = 0) <> (credit_cents = 0) or (debit_cents = 0 and credit_cents = 0))
);
create index on public.journal_lines (entry_id);
create index on public.journal_lines (community_id, account_code);

-- ---------- Registro de auditoría ----------
create table public.audit_log (
  id bigserial primary key,
  community_id uuid,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  user_id uuid,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);
create index on public.audit_log (community_id, changed_at desc);
