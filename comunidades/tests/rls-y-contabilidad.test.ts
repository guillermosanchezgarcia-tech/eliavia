/**
 * Tests contra una base de datos PostgreSQL real: permisos RLS, saldos, fondo de reserva y contabilidad.
 * Necesitan TEST_DATABASE_URL (conexión de superusuario a un PostgreSQL local, NO a producción).
 * Ejemplo: TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres npm test
 */
import { readFileSync } from "fs";
import path from "path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../scripts/migrate";
import { checkReserveFund } from "@/lib/cuotas";

const BASE_URL = process.env.TEST_DATABASE_URL;
const dbName = `cf_test_${Date.now()}`;
let db: Client;

const ids = {
  admin: "00000000-0000-0000-0000-00000000000a",
  president: "00000000-0000-0000-0000-00000000000b",
  userA: "00000000-0000-0000-0000-0000000000a1",
  userB: "00000000-0000-0000-0000-0000000000b1",
  stranger: "00000000-0000-0000-0000-0000000000ff",
};
const f: Record<string, string> = {};

async function as<T>(userId: string, fn: (c: Client) => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: "authenticated" })]);
    const result = await fn(db);
    await db.query("commit");
    return result;
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

async function one(sql: string, params: unknown[] = []) {
  return (await db.query(sql, params)).rows[0];
}

describe.skipIf(!BASE_URL)("base de datos: permisos y contabilidad", () => {
  beforeAll(async () => {
    const admin = new Client({ connectionString: BASE_URL });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    await admin.end();
    const url = BASE_URL!.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
    db = new Client({ connectionString: url });
    await db.connect();
    await db.query(readFileSync(path.join(__dirname, "sql", "supabase_stub.sql"), "utf8"));
    await migrate(url, () => {});

    for (const [k, id] of Object.entries(ids)) {
      await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${k}@example.com`]);
    }
    f.community = (await one("insert into communities (name, reserve_fund_pct) values ('C.P. Test', 10) returning id")).id;
    await db.query("select init_community($1, $2)", [f.community, ids.admin]);
    await db.query("insert into memberships (community_id, user_id, role) values ($1,$2,'president'),($1,$2,'owner'),($1,$3,'owner'),($1,$4,'owner')",
      [f.community, ids.president, ids.userA, ids.userB]);
    f.bank = (await one("insert into bank_accounts (community_id, name, iban) values ($1, 'Banco', 'ES00') returning id", [f.community])).id;
    f.propA = (await one("insert into properties (community_id, code, coefficient, sort_order) values ($1, '1ºA', 60, 1) returning id", [f.community])).id;
    f.propB = (await one("insert into properties (community_id, code, coefficient, sort_order) values ($1, '1ºB', 40, 2) returning id", [f.community])).id;
    f.ownerA = (await one("insert into owners (community_id, full_name, user_id) values ($1, 'Ana', $2) returning id", [f.community, ids.userA])).id;
    f.ownerB = (await one("insert into owners (community_id, full_name, user_id) values ($1, 'Bea', $2) returning id", [f.community, ids.userB])).id;
    await db.query("insert into ownerships (community_id, property_id, owner_id, start_date) values ($1,$2,$3,'2020-01-01'),($1,$4,$5,'2020-01-01')",
      [f.community, f.propA, f.ownerA, f.propB, f.ownerB]);
    const cat = async (code: string) => (await one("select id from categories where community_id = $1 and code = $2", [f.community, code])).id;
    f.cuotas = await cat("I01");
    f.fondo = await cat("R01");
    f.limpieza = await cat("G01");
    f.key = (await one("select id from allocation_keys where community_id = $1", [f.community])).id;
    f.budget = (await one(`insert into budgets (community_id, name, status, installments, interval_months, first_due_date, fiscal_year_id)
      values ($1, 'Presupuesto 2026', 'approved', 2, 6, '2026-01-01', fiscal_year_for($1, '2026-01-01')) returning id`, [f.community])).id;
    await db.query("insert into budget_lines (budget_id, category_id, allocation_key_id, amount_cents) values ($1,$2,$4,1000000),($1,$3,$4,50000)",
      [f.budget, f.limpieza, f.fondo, f.key]);
    // Saldo inicial del fondo de reserva: 1.000,00 €
    const opening = (await one(`insert into journal_entries (community_id, fiscal_year_id, entry_date, description, source_type)
      values ($1, fiscal_year_for($1, '2026-01-01'), '2026-01-01', 'Apertura', 'opening') returning id`, [f.community])).id;
    await db.query("insert into journal_lines (entry_id, community_id, account_code, debit_cents, bank_account_id) values ($1,$2,'572',100000,$3)",
      [opening, f.community, f.bank]);
    await db.query("insert into journal_lines (entry_id, community_id, account_code, credit_cents) values ($1,$2,'113',100000)", [opening, f.community]);
  });

  afterAll(async () => {
    if (!db) return;
    await db.end();
    const admin = new Client({ connectionString: BASE_URL });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.end();
  });

  it("el administrador emite recibos con numeración correlativa y asientos cuadrados", async () => {
    const receipts = [
      { property_id: f.propA, owner_id: f.ownerA, amount: 30000 },
      { property_id: f.propB, owner_id: f.ownerB, amount: 20000 },
    ].flatMap((r, i) => [1, 2].map((inst) => ({
      budget_id: f.budget, installment: inst, property_id: r.property_id, owner_id: r.owner_id,
      concept: `Cuota ${inst}`, issue_date: inst === 1 ? "2026-01-01" : "2026-07-01", due_date: inst === 1 ? "2026-01-01" : "2026-07-01",
      lines: [{ category_id: f.cuotas, amount_cents: r.amount - 1000 * (i + 1) }, { category_id: f.fondo, amount_cents: 1000 * (i + 1) }],
    })));
    const n = await as(ids.admin, async (c) => (await c.query("select create_receipts($1, $2::jsonb) as n", [f.community, JSON.stringify(receipts)])).rows[0].n);
    expect(n).toBe(4);
    const codes = (await db.query("select code from receipts order by number")).rows.map((r) => r.code);
    expect(codes).toEqual(["2026/00001", "2026/00002", "2026/00003", "2026/00004"]);
    const bal = await one("select sum(debit_cents)::bigint d, sum(credit_cents)::bigint c from journal_lines");
    expect(bal.d).toBe(bal.c);
  });

  it("el administrador registra cobros y el saldo del propietario es correcto", async () => {
    await as(ids.admin, (c) => c.query(
      "insert into payments (community_id, owner_id, payment_date, amount_cents, method, bank_account_id) values ($1,$2,'2026-01-10',45000,'transferencia',$3),($1,$4,'2026-01-10',20000,'bizum',$3)",
      [f.community, f.ownerA, f.bank, f.ownerB]));
    const a = await as(ids.userA, async (c) => (await c.query("select * from v_owner_balances")).rows);
    expect(a).toHaveLength(1);
    expect(a[0].owner_id).toBe(f.ownerA);
    expect(Number(a[0].charged_cents)).toBe(60000);
    expect(Number(a[0].paid_cents)).toBe(45000);
    expect(Number(a[0].balance_cents)).toBe(15000);
    const rec = await as(ids.userA, async (c) => (await c.query("select installment, paid_cents from v_receipts order by due_date")).rows);
    expect(rec.map((r) => Number(r.paid_cents))).toEqual([30000, 15000]); // el cobro se aplica primero al recibo más antiguo
  });

  it("un propietario NO puede leer los pagos ni recibos de otro", async () => {
    const pays = await as(ids.userA, async (c) => (await c.query("select owner_id from payments")).rows);
    expect(pays.every((p) => p.owner_id === f.ownerA)).toBe(true);
    const other = await as(ids.userA, async (c) => (await c.query("select * from payments where owner_id = $1", [f.ownerB])).rows);
    expect(other).toHaveLength(0);
    const otherReceipts = await as(ids.userA, async (c) => (await c.query("select * from receipts where owner_id = $1", [f.ownerB])).rows);
    expect(otherReceipts).toHaveLength(0);
    const otherOwner = await as(ids.userA, async (c) => (await c.query("select * from owners where id = $1", [f.ownerB])).rows);
    expect(otherOwner).toHaveLength(0);
    const ledger = await as(ids.userA, async (c) => (await c.query("select * from journal_lines")).rows);
    expect(ledger).toHaveLength(0);
  });

  it("un propietario recibe un error si intenta acceder a informes reservados o escribir datos", async () => {
    await expect(as(ids.userA, (c) => c.query("select * from bank_balances($1)", [f.community]))).rejects.toThrow(/No autorizado/);
    await expect(as(ids.userA, (c) => c.query(
      "insert into payments (community_id, owner_id, payment_date, amount_cents, bank_account_id) values ($1,$2,'2026-02-01',1,$3)",
      [f.community, f.ownerA, f.bank]))).rejects.toThrow(/row-level security/);
    await expect(as(ids.userA, (c) => c.query("select init_community($1, $2)", [f.community, ids.userA]))).rejects.toThrow(/permission denied/);
    const upd = await as(ids.userA, async (c) => (await c.query("update payments set amount_cents = 1 returning id")).rowCount);
    expect(upd).toBe(0);
  });

  it("alguien ajeno a la comunidad no ve nada", async () => {
    const rows = await as(ids.stranger, async (c) => (await c.query("select * from communities")).rows);
    expect(rows).toHaveLength(0);
    await expect(as(ids.stranger, (c) => c.query("select * from reserve_fund_status($1)", [f.community]))).rejects.toThrow(/No autorizado/);
  });

  it("el presidente ve el estado de cuentas completo pero no puede modificarlo", async () => {
    const pays = await as(ids.president, async (c) => (await c.query("select * from payments")).rows);
    expect(pays).toHaveLength(2);
    const debtors = await as(ids.president, async (c) => (await c.query("select * from v_owner_balances where balance_cents > 0")).rows);
    expect(debtors.map((d) => d.full_name).sort()).toEqual(["Ana", "Bea"]);
    await expect(as(ids.president, (c) => c.query(
      "insert into payments (community_id, owner_id, payment_date, amount_cents, bank_account_id) values ($1,$2,'2026-02-01',1,$3)",
      [f.community, f.ownerA, f.bank]))).rejects.toThrow(/row-level security/);
  });

  it("los documentos restringidos no los ve el propietario, sí el presidente", async () => {
    await db.query(`insert into documents (community_id, kind, title, storage_path, restricted) values
      ($1::uuid, 'factura', 'Factura limpieza', $1::text || '/facturas/limpieza.pdf', false),
      ($1::uuid, 'factura', 'Minuta abogado monitorio', $1::text || '/facturas/abogado.pdf', true)`, [f.community]);
    await db.query(`insert into storage.objects (bucket_id, name) values ('documentos', $1::text || '/facturas/limpieza.pdf'), ('documentos', $1::text || '/facturas/abogado.pdf')`, [f.community]);
    const owner = await as(ids.userA, async (c) => (await c.query("select title from documents")).rows.map((r) => r.title));
    expect(owner).toEqual(["Factura limpieza"]);
    const files = await as(ids.userA, async (c) => (await c.query("select name from storage.objects")).rows);
    expect(files).toHaveLength(1);
    const pres = await as(ids.president, async (c) => (await c.query("select title from documents")).rows);
    expect(pres).toHaveLength(2);
    await expect(as(ids.userA, (c) => c.query("insert into storage.objects (bucket_id, name) values ('documentos', $1::text || '/x.pdf')", [f.community])))
      .rejects.toThrow(/row-level security/);
  });

  it("gasto con retención IRPF y pago con cargo al fondo de reserva", async () => {
    await as(ids.admin, (c) => c.query(`insert into expenses (community_id, category_id, invoice_date, base_cents, vat_pct, vat_cents, irpf_pct, irpf_cents, total_cents, paid_date, paid_bank_account_id)
      values ($1, $2, '2026-02-01', 18000, 21, 3780, 15, 2700, 21780, '2026-02-05', $3)`, [f.community, f.limpieza, f.bank]));
    const e = await one("select payable_cents from expenses where base_cents = 18000");
    expect(Number(e.payable_cents)).toBe(19080);
    await as(ids.admin, (c) => c.query(`insert into expenses (community_id, category_id, invoice_date, base_cents, vat_cents, total_cents, charged_to_reserve)
      values ($1, $2, '2026-03-01', 80000, 16800, 96800, true)`, [f.community, f.limpieza]));
    const bal = await one("select sum(debit_cents)::bigint d, sum(credit_cents)::bigint c from journal_lines");
    expect(bal.d).toBe(bal.c);
  });

  it("fondo de reserva: saldo, mínimo legal y aviso coinciden con el cálculo de la app", async () => {
    const s = await as(ids.userA, async (c) => (await c.query("select * from reserve_fund_status($1)", [f.community])).rows[0]);
    // 1.000 € apertura + 60 € aportaciones (2×10 + 2×20) − 968 € pagados con cargo al fondo = 92 €
    expect(Number(s.balance_cents)).toBe(100000 + 6000 - 96800);
    expect(Number(s.base_budget_cents)).toBe(1000000);
    expect(Number(s.minimum_cents)).toBe(100000);
    const check = checkReserveFund(Number(s.balance_cents), Number(s.base_budget_cents), s.pct);
    expect(check.belowMinimum).toBe(true);
    expect(Number(s.shortfall_cents)).toBe(check.replenishmentCents);
  });

  it("el informe por partidas cuadra con los movimientos", async () => {
    const rows = await as(ids.admin, async (c) => (await c.query("select * from ledger_summary($1, '2026-01-01', '2026-12-31', 'year')", [f.community])).rows);
    const get = (section: string, code: string) => Number(rows.find((r) => r.section === section && r.category_code === code)?.amount_cents ?? 0);
    expect(get("income", "I01")).toBe(100000 - 6000);
    expect(get("reserve_in", "R01")).toBe(6000);
    expect(get("expense", "G01")).toBe(21780);
    expect(get("reserve_out", "G01")).toBe(96800);
    const expenses = await one("select sum(total_cents)::bigint t from expenses where not charged_to_reserve");
    expect(get("expense", "G01")).toBe(Number(expenses.t));
  });

  it("registro de auditoría con el usuario que hizo cada cambio", async () => {
    const log = await as(ids.admin, async (c) => (await c.query("select user_id from audit_log where table_name = 'payments'")).rows);
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((l) => l.user_id === ids.admin)).toBe(true);
    const ownerLog = await as(ids.userA, async (c) => (await c.query("select * from audit_log")).rows);
    expect(ownerLog).toHaveLength(0);
  });

  it("un ejercicio cerrado no admite cambios", async () => {
    await db.query("update fiscal_years set status = 'closed' where community_id = $1 and year = 2026", [f.community]);
    await expect(as(ids.admin, (c) => c.query(
      "insert into payments (community_id, owner_id, payment_date, amount_cents, bank_account_id) values ($1,$2,'2026-05-01',100,$3)",
      [f.community, f.ownerA, f.bank]))).rejects.toThrow(/cerrado/);
    await expect(as(ids.admin, (c) => c.query("delete from payments where community_id = $1", [f.community]))).rejects.toThrow(/cerrado/);
    await db.query("update fiscal_years set status = 'open' where community_id = $1 and year = 2026", [f.community]);
  });
});
