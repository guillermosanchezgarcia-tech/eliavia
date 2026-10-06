/**
 * Datos de ejemplo: «Comunidad de Propietarios Calle del Olmo, 14» (ficticia)
 * 12 viviendas, 2 locales y 8 garajes, con presupuesto 2026, recibos, cobros, facturas escaneadas y documentos.
 *
 * Uso:   npm run db:seed            (la primera vez)
 *        npm run db:seed -- --reset (borra los datos de ejemplo y los vuelve a crear)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "pg";
import { dbClient } from "./db";
import { planReceipts, type QuotaContext } from "../src/lib/cuotas";
import { pctOf } from "../src/lib/money";
import { addMonths } from "../src/lib/dates";
import { invoicePdf, textPdf } from "../src/lib/pdf";
import { defaultPrivacyPolicy } from "../src/lib/privacidad";

export const DEMO_PASSWORD = "Comunidad2026!";
const COMMUNITY_NAME = "Comunidad de Propietarios Calle del Olmo, 14";
const COMMUNITY2_NAME = "Comunidad de Propietarios Residencial Los Pinos";

const USERS = {
  admin: { email: "admin@example.com", name: "Laura Martín (administradora)" },
  president: { email: "presidente@example.com", name: "Lucía Fernández Molina" },
  owner1a: { email: "propietario1a@example.com", name: "Ana López García" },
  owner2a: { email: "propietario2a@example.com", name: "Pablo Herrero Ortega" },
} as const;

type UserKey = keyof typeof USERS;

/** NIF ficticio con letra de control válida */
function nif(n: number): string {
  const num = String(n).padStart(8, "0");
  return num + "TRWAGMYFPDXBNJZSQVHLCKE"[n % 23];
}

async function ensureUsers(supa: SupabaseClient): Promise<Record<UserKey, string>> {
  const { data, error } = await supa.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`No se pudo conectar con Supabase Auth: ${error.message}`);
  const out = {} as Record<UserKey, string>;
  for (const [key, u] of Object.entries(USERS) as [UserKey, (typeof USERS)[UserKey]][]) {
    const existing = data.users.find((x) => x.email === u.email);
    if (existing) {
      out[key] = existing.id;
      await supa.auth.admin.updateUserById(existing.id, { password: DEMO_PASSWORD });
      continue;
    }
    const created = await supa.auth.admin.createUser({
      email: u.email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { full_name: u.name },
    });
    if (created.error) throw new Error(`No se pudo crear ${u.email}: ${created.error.message}`);
    out[key] = created.data.user.id;
  }
  return out;
}

async function insert(db: Client, table: string, row: Record<string, unknown>): Promise<string> {
  const keys = Object.keys(row);
  const sql = `insert into ${table} (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning id`;
  const res = await db.query(sql, Object.values(row));
  return res.rows[0].id;
}

interface Upload {
  path: string;
  bytes: Uint8Array;
}

export async function seed() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  }
  const reset = process.argv.includes("--reset");
  const supa = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const db = dbClient();
  await db.connect();

  try {
    const existing = await db.query("select id from communities where name = any($1)", [[COMMUNITY_NAME, COMMUNITY2_NAME]]);
    if (existing.rowCount && !reset) {
      console.log("ℹ Los datos de ejemplo ya existen. Para volver a crearlos: npm run db:seed -- --reset");
      return;
    }

    console.log("→ Creando usuarios de prueba");
    const users = await ensureUsers(supa);

    await db.query("begin");
    if (existing.rowCount) {
      console.log("→ Borrando los datos de ejemplo anteriores");
      const ids = existing.rows.map((r) => r.id);
      const docs = await db.query("select storage_path from documents where community_id = any($1)", [ids]);
      if (docs.rowCount) await supa.storage.from("documentos").remove(docs.rows.map((d) => d.storage_path));
      await db.query("update fiscal_years set status = 'open' where community_id = any($1)", [ids]);
      await db.query("delete from communities where id = any($1)", [ids]);
    }

    const uploads: Upload[] = [];
    const cid = await buildOlmo(db, users, uploads);
    await buildPinos(db, users);

    console.log(`→ Subiendo ${uploads.length} documentos escaneados de ejemplo`);
    for (const u of uploads) {
      const { error } = await supa.storage.from("documentos").upload(u.path, u.bytes, { contentType: "application/pdf", upsert: true });
      if (error) throw new Error(`Error subiendo ${u.path}: ${error.message}`);
    }
    await db.query("commit");
    console.log(`✔ Datos de ejemplo creados (comunidad ${cid}).`);
    console.log(`\nUsuarios de prueba (contraseña para todos: ${DEMO_PASSWORD})`);
    console.log(`  Administradora: ${USERS.admin.email}`);
    console.log(`  Presidenta:     ${USERS.president.email}  (2ºB)`);
    console.log(`  Propietaria:    ${USERS.owner1a.email}  (1ºA + Garaje 1)`);
    console.log(`  Propietario:    ${USERS.owner2a.email}  (2ºA + Garaje 3)`);
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  } finally {
    await db.end();
  }
}

async function buildOlmo(db: Client, users: Record<UserKey, string>, uploads: Upload[]): Promise<string> {
  console.log(`→ Creando «${COMMUNITY_NAME}»`);
  const community = {
    name: COMMUNITY_NAME,
    cif: "H12345674",
    address: "Calle del Olmo, 14",
    postal_code: "28999",
    city: "Villanueva del Ejemplo",
    province: "Madrid",
    region: "Comunidad de Madrid",
    reserve_fund_pct: 10,
    secretary_name: "Laura Martín Ruiz (administradora-secretaria)",
  };
  const cid = await insert(db, "communities", { ...community, privacy_policy: defaultPrivacyPolicy(community), created_by: users.admin });
  await db.query("select init_community($1, $2)", [cid, users.admin]);
  await db.query(
    "insert into memberships (community_id, user_id, role) values ($1,$2,'president'),($1,$2,'owner'),($1,$3,'owner'),($1,$4,'owner')",
    [cid, users.president, users.owner1a, users.owner2a]
  );

  const bank = await insert(db, "bank_accounts", { community_id: cid, name: "Cuenta principal", iban: "ES9121000418450200051332", is_default: true });
  const cash = await insert(db, "bank_accounts", { community_id: cid, name: "Caja", is_cash: true });

  // ---------- Inmuebles: coeficientes que suman 100 % ----------
  const props: { id: string; code: string; coefficient: string; sort_order: number; kind: string; tourist?: boolean }[] = [];
  let order = 0;
  for (const floor of [1, 2, 3, 4]) {
    for (const [door, coef] of [["A", "7.0000"], ["B", "6.5000"], ["C", "6.0000"]] as const) {
      props.push({ id: "", code: `${floor}º${door}`, coefficient: coef, sort_order: ++order, kind: "vivienda", tourist: floor === 3 && door === "C" });
    }
  }
  props.push({ id: "", code: "Local 1", coefficient: "5.0000", sort_order: ++order, kind: "local" });
  props.push({ id: "", code: "Local 2", coefficient: "5.0000", sort_order: ++order, kind: "local" });
  for (let g = 1; g <= 8; g++) props.push({ id: "", code: `Garaje ${g}`, coefficient: "1.5000", sort_order: ++order, kind: "garaje" });
  for (const p of props) {
    p.id = await insert(db, "properties", {
      community_id: cid, kind: p.kind, code: p.code, coefficient: p.coefficient, sort_order: p.sort_order,
      description: p.kind === "vivienda" ? "Vivienda" : p.kind === "local" ? "Local comercial en planta baja" : "Plaza de garaje en sótano",
      tourist_use: !!p.tourist, tourist_surcharge_pct: p.tourist ? 20 : 0,
    });
  }
  const P = (code: string) => props.find((p) => p.code === code)!.id;

  // ---------- Grupos y repartos ----------
  const groups: Record<string, string> = {};
  for (const [name, kind] of [["Viviendas (usuarios del ascensor)", "vivienda"], ["Locales", "local"], ["Garajes", "garaje"]]) {
    groups[kind] = await insert(db, "property_groups", { community_id: cid, name });
    for (const p of props.filter((x) => x.kind === kind)) {
      await db.query("insert into property_group_members (group_id, property_id) values ($1, $2)", [groups[kind], p.id]);
    }
  }
  const keyGeneral = (await db.query("select id from allocation_keys where community_id = $1 and is_default", [cid])).rows[0].id;
  const keyAscensor = await insert(db, "allocation_keys", { community_id: cid, name: "Ascensor (solo viviendas)", method: "coefficient", group_id: groups.vivienda });
  const keyGarajes = await insert(db, "allocation_keys", { community_id: cid, name: "Solo garajes", method: "coefficient", group_id: groups.garaje });
  const keyIguales = await insert(db, "allocation_keys", { community_id: cid, name: "Partes iguales", method: "equal" });
  void keyIguales;

  // ---------- Propietarios e histórico de titulares ----------
  const ownerDefs: { name: string; n: number; props: string[]; user?: UserKey; email?: string; phone: string; company?: string }[] = [
    { name: "Ana López García", n: 12345678, props: ["1ºA", "Garaje 1"], user: "owner1a", phone: "600111222" },
    { name: "Javier Romero Sanz", n: 23456789, props: ["1ºB"], phone: "600222333" },
    { name: "Carmen Ruiz Navarro", n: 34567890, props: ["1ºC", "Garaje 2"], phone: "600333444" },
    { name: "Pablo Herrero Ortega", n: 45678901, props: ["2ºA", "Garaje 3"], user: "owner2a", phone: "600444555" },
    { name: "Lucía Fernández Molina", n: 56789012, props: ["2ºB"], user: "president", phone: "600555666" },
    { name: "Miguel Torres Castillo", n: 67890123, props: ["2ºC"], phone: "600666777" },
    { name: "Elena Moreno Díaz", n: 78901234, props: ["3ºA", "Garaje 4"], phone: "600777888" },
    { name: "Raúl Jiménez Vega", n: 89012345, props: ["3ºB", "Garaje 8"], phone: "600888999" },
    { name: "Inversiones Turísticas Olmo S.L.", n: 0, company: "B00000000", props: ["3ºC"], phone: "910000001" },
    { name: "Isabel Gómez Prieto", n: 90123456, props: ["4ºA", "Garaje 5"], phone: "600999000" },
    { name: "Antonio Martín Ramos", n: 11223344, props: ["4ºB", "Garaje 6"], phone: "611000111" },
    { name: "Sofía Navarro Gil", n: 22334455, props: ["4ºC"], phone: "611111222" },
    { name: "Panadería La Espiga S.L.", n: 0, company: "B11111111", props: ["Local 1"], phone: "910000002" },
    { name: "Farmacia Hernández C.B.", n: 0, company: "E22222222", props: ["Local 2"], phone: "910000003" },
    { name: "David Castro Peña", n: 33445566, props: ["Garaje 7"], phone: "622000111" },
  ];
  const ownerIds: Record<string, string> = {};
  let ibanSeq = 1000;
  for (const o of ownerDefs) {
    const user = o.user ? users[o.user] : null;
    ownerIds[o.name] = await insert(db, "owners", {
      community_id: cid, full_name: o.name, nif: o.company ?? nif(o.n),
      email: o.user ? USERS[o.user].email : `${o.name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}@example.com`,
      phone: o.phone, iban: `ES7621000000${String(ibanSeq++).padStart(12, "0")}`, user_id: user,
      address: o.company ? "Calle del Olmo, 14 (bajo)" : null,
    });
  }
  // 1ºB cambió de titular el 01/07/2025 (compraventa): ejemplo de histórico
  const prevOwner = await insert(db, "owners", { community_id: cid, full_name: "Herederos de Tomás Romero Gil", nif: nif(44556677), phone: "633000111" });
  const ownerOfProp: Record<string, string> = {};
  for (const o of ownerDefs) {
    for (const code of o.props) {
      const start = code === "1ºB" ? "2025-07-01" : "2015-01-01";
      await db.query("insert into ownerships (community_id, property_id, owner_id, start_date) values ($1,$2,$3,$4)", [cid, P(code), ownerIds[o.name], start]);
      ownerOfProp[P(code)] = ownerIds[o.name];
    }
  }
  await db.query("insert into ownerships (community_id, property_id, owner_id, start_date, end_date) values ($1,$2,$3,'2015-01-01','2025-06-30')", [cid, P("1ºB"), prevOwner]);

  // ---------- Partidas ----------
  const cats: Record<string, string> = {};
  for (const r of (await db.query("select id, code from categories where community_id = $1", [cid])).rows) cats[r.code] = r.id;

  // ---------- Proveedores ----------
  const sup = async (name: string, nifS: string, category: string, extra: Record<string, unknown> = {}) =>
    insert(db, "suppliers", { community_id: cid, name, nif: nifS, category, iban: "ES1000490000000000000000".slice(0, 4) + String(Math.abs(hash(name))).padStart(20, "0").slice(0, 20), ...extra });
  const S = {
    limpieza: await sup("Limpiezas Brillo S.L.", "B30000001", "Limpieza"),
    ascensor: await sup("Ascensores Elevia S.A.", "A30000002", "Ascensor"),
    luz: await sup("Eléctrica del Centro S.A.", "A30000003", "Suministros", { is_utility: true }),
    agua: await sup("Aguas Municipales de Villanueva", "P2899900A", "Suministros", { is_utility: true }),
    seguro: await sup("Seguros La Previsora S.A.", "A30000005", "Seguros"),
    admin: await sup("Laura Martín Ruiz · Gestión de Fincas", nif(55667788), "Administración", { applies_withholding: true, withholding_pct: 15 }),
    puerta: await sup("Puertas Automáticas Norte S.L.", "B30000007", "Mantenimiento"),
    fontaneria: await sup("Fontanería Rápida S.L.", "B30000008", "Reparaciones"),
    obras: await sup("Construcciones y Reformas Olmo S.L.", "B30000009", "Obras"),
    abogado: await sup("Ortega & Asociados Abogados", nif(66778899), "Asesoría jurídica", { applies_withholding: true, withholding_pct: 15 }),
    antena: await sup("Telecomunicaciones Antena Sur S.A.", "A30000011", "Arrendatario (ingresos)"),
  };

  // ---------- Saldo de apertura 01/01/2026 ----------
  const fy = (await db.query("select fiscal_year_for($1, '2026-01-01') as id", [cid])).rows[0].id;
  const opening = await insert(db, "journal_entries", {
    community_id: cid, fiscal_year_id: fy, entry_date: "2026-01-01", description: "Asiento de apertura del ejercicio 2026", source_type: "opening", created_by: users.admin,
  });
  await db.query(
    `insert into journal_lines (entry_id, community_id, account_code, debit_cents, credit_cents, bank_account_id) values
      ($1, $2, '572', 435000, 0, $3), ($1, $2, '113', 0, 145000, null), ($1, $2, '120', 0, 290000, null)`,
    [opening, cid, bank]
  );

  // ---------- Presupuesto ordinario 2026 (aprobado en junta 15/12/2025), cuotas trimestrales ----------
  const budget = {
    id: "", name: "Presupuesto ordinario 2026", kind: "ordinary" as const, installments: 4, interval_months: 3, first_due_date: "2026-01-01",
  };
  budget.id = await insert(db, "budgets", {
    community_id: cid, fiscal_year_id: fy, kind: "ordinary", name: budget.name, status: "approved", approved_at: "2025-12-15",
    installments: 4, interval_months: 3, first_due_date: budget.first_due_date, notes: "Aprobado en junta general ordinaria de 15/12/2025",
  });
  const lineDefs: [string, string, number, string][] = [
    ["G01", keyGeneral, 480000, "Limpieza de zonas comunes"],
    ["G02", keyAscensor, 240000, "Mantenimiento del ascensor"],
    ["G03", keyGeneral, 180000, "Electricidad zonas comunes"],
    ["G04", keyGeneral, 90000, "Agua zonas comunes"],
    ["G05", keyGeneral, 150000, "Seguro multirriesgo"],
    ["G06", keyGeneral, 240000, "Honorarios de administración"],
    ["G07", keyGeneral, 120000, "Mantenimiento general"],
    ["G07", keyGarajes, 60000, "Mantenimiento puerta de garaje"],
    ["G10", keyGeneral, 100000, "Pequeñas reparaciones"],
    ["R01", keyGeneral, 170000, "Aportación al fondo de reserva"],
  ];
  const budgetLines = [];
  for (const [code, key, amount, description] of lineDefs) {
    const id = await insert(db, "budget_lines", { budget_id: budget.id, category_id: cats[code], allocation_key_id: key, amount_cents: amount, description });
    budgetLines.push({ id, category_id: cats[code], category_kind: (code.startsWith("R") ? "reserve" : "expense") as "reserve" | "expense", allocation_key_id: key, amount_cents: amount });
  }

  // ---------- Recibos de los 4 trimestres ----------
  const ctx: QuotaContext = {
    properties: props.map((p) => ({ id: p.id, code: p.code, coefficient: p.coefficient, sort_order: p.sort_order, tourist_use: !!p.tourist, tourist_surcharge_pct: p.tourist ? 20 : 0 })),
    keys: [
      { id: keyGeneral, method: "coefficient", group_id: null },
      { id: keyAscensor, method: "coefficient", group_id: groups.vivienda },
      { id: keyGarajes, method: "coefficient", group_id: groups.garaje },
    ],
    groupMembers: new Map(Object.values(groups).map((g) => [g, new Set<string>()])),
    customWeights: new Map(),
    incomeCategoryId: cats.I01,
  };
  for (const p of props) ctx.groupMembers.get(groups[p.kind])!.add(p.id);
  const planned = planReceipts(budget, budgetLines, ctx);
  const receiptsByOwnerInst = new Map<string, number>();
  for (const r of planned) {
    const owner = ownerOfProp[r.property_id];
    const rid = await insert(db, "receipts", {
      community_id: cid, budget_id: r.budget_id, installment: r.installment, property_id: r.property_id, owner_id: owner,
      concept: r.concept, issue_date: r.issue_date, due_date: r.due_date, amount_cents: r.amount_cents,
    });
    for (const l of r.lines) {
      await db.query("insert into receipt_lines (receipt_id, category_id, amount_cents) values ($1,$2,$3)", [rid, l.category_id, l.amount_cents]);
    }
    const k = `${owner}|${r.installment}`;
    receiptsByOwnerInst.set(k, (receiptsByOwnerInst.get(k) ?? 0) + r.amount_cents);
  }

  // ---------- Cobros (con algunos morosos) ----------
  const methodOf = (name: string): [string, string] =>
    name.startsWith("Ana") ? ["transferencia", bank] : name.startsWith("Sofía") ? ["bizum", bank] : name.startsWith("Raúl") ? ["efectivo", cash] : ["domiciliacion", bank];
  let day = 0;
  for (const o of ownerDefs) {
    const oid = ownerIds[o.name];
    for (const inst of [1, 2, 3, 4]) {
      let amount = receiptsByOwnerInst.get(`${oid}|${inst}`) ?? 0;
      if (o.name.startsWith("Miguel") && inst >= 3) continue; // 2ºC: debe 2 trimestres
      if (o.name.startsWith("Antonio") && inst === 4) continue; // 4ºB: debe el último trimestre
      if (o.name.startsWith("Farmacia") && inst === 4) continue; // Local 2: debe el último trimestre...
      if (o.name.startsWith("Farmacia") && inst === 3) amount = Math.floor(amount / 2); // ...y la mitad del tercero
      if (!amount) continue;
      const [method, account] = methodOf(o.name);
      const due = addMonths(budget.first_due_date, (inst - 1) * 3);
      const date = addMonths(due, 0).slice(0, 8) + String(1 + (day++ % 4)).padStart(2, "0");
      await insert(db, "payments", {
        community_id: cid, owner_id: oid, payment_date: date, amount_cents: amount, method, bank_account_id: account,
        reference: `Cuota ${inst}T 2026`, notes: o.props.join(" + "),
      });
    }
  }
  // Otros ingresos: alquiler de la azotea para antena de telefonía (300 €/trimestre) e intereses
  for (const m of ["2026-01-10", "2026-04-10", "2026-07-10"]) {
    await insert(db, "payments", { community_id: cid, category_id: cats.I03, payment_date: m, amount_cents: 30000, method: "transferencia", bank_account_id: bank, reference: "Alquiler azotea · Telecomunicaciones Antena Sur S.A." });
  }
  await insert(db, "payments", { community_id: cid, category_id: cats.I04, payment_date: "2026-06-30", amount_cents: 312, method: "otro", bank_account_id: bank, reference: "Intereses cuenta 1er semestre" });

  // ---------- Facturas de proveedores con su PDF «escaneado» ----------
  let invSeq = 100;
  const addExpense = async (e: {
    supplier: string; supplierName: string; supplierNif: string; cat: string; key?: string; date: string; concept: string;
    base: number; vatPct: number; irpfPct?: number; paid?: string | null; reserve?: boolean; restricted?: boolean;
  }) => {
    const vat = pctOf(e.base, e.vatPct);
    const irpf = e.irpfPct ? pctOf(e.base, e.irpfPct) : 0;
    const number = `F-${e.date.slice(0, 4)}-${String(invSeq++)}`;
    const path = `${cid}/facturas/${e.date.slice(0, 4)}/${number}.pdf`;
    const bytes = await invoicePdf({
      supplier: e.supplierName, supplierNif: e.supplierNif, number, date: e.date, customer: COMMUNITY_NAME, customerCif: community.cif,
      customerAddress: `${community.address}, ${community.postal_code} ${community.city}`, concept: e.concept,
      baseCents: e.base, vatPct: e.vatPct, vatCents: vat, irpfPct: e.irpfPct ?? 0, irpfCents: irpf, totalCents: e.base + vat,
    });
    uploads.push({ path, bytes });
    const doc = await insert(db, "documents", {
      community_id: cid, kind: "factura", title: `${e.supplierName} · ${number}`, doc_date: e.date, storage_path: path,
      mime_type: "application/pdf", size_bytes: bytes.length, restricted: !!e.restricted, uploaded_by: users.admin,
    });
    await insert(db, "expenses", {
      community_id: cid, supplier_id: e.supplier, category_id: cats[e.cat], allocation_key_id: e.key ?? keyGeneral,
      invoice_number: number, invoice_date: e.date, description: e.concept, base_cents: e.base, vat_pct: e.vatPct, vat_cents: vat,
      irpf_pct: e.irpfPct ?? 0, irpf_cents: irpf, total_cents: e.base + vat, charged_to_reserve: !!e.reserve,
      paid_date: e.paid === null ? null : e.paid ?? addDays(e.date, 5), paid_bank_account_id: e.paid === null ? null : bank,
      restricted: !!e.restricted, document_id: doc,
    });
  };
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09"];
  for (const m of months) {
    await addExpense({ supplier: S.limpieza, supplierName: "Limpiezas Brillo S.L.", supplierNif: "B30000001", cat: "G01", date: `2026-${m}-28`, concept: `Servicio de limpieza de zonas comunes · mes ${m}/2026`, base: 33058, vatPct: 21 });
    await addExpense({ supplier: S.admin, supplierName: "Laura Martín Ruiz · Gestión de Fincas", supplierNif: nif(55667788), cat: "G06", date: `2026-${m}-30`.replace("02-30", "02-28"), concept: `Honorarios de administración · mes ${m}/2026`, base: 16529, vatPct: 21, irpfPct: 15 });
  }
  await addExpense({ supplier: S.limpieza, supplierName: "Limpiezas Brillo S.L.", supplierNif: "B30000001", cat: "G01", date: "2026-10-01", concept: "Servicio de limpieza de zonas comunes · mes 10/2026", base: 33058, vatPct: 21, paid: null });
  for (const m of ["01", "04", "07"]) {
    await addExpense({ supplier: S.ascensor, supplierName: "Ascensores Elevia S.A.", supplierNif: "A30000002", cat: "G02", key: keyAscensor, date: `2026-${m}-15`, concept: "Mantenimiento trimestral del ascensor", base: 49587, vatPct: 21 });
    await addExpense({ supplier: S.puerta, supplierName: "Puertas Automáticas Norte S.L.", supplierNif: "B30000007", cat: "G07", key: keyGarajes, date: `2026-${m}-20`, concept: "Mantenimiento trimestral puerta de garaje", base: 12397, vatPct: 21 });
    await addExpense({ supplier: S.agua, supplierName: "Aguas Municipales de Villanueva", supplierNif: "P2899900A", cat: "G04", date: `2026-${m}-25`, concept: "Consumo de agua zonas comunes (trimestre)", base: 18000, vatPct: 10 });
  }
  for (const [m, base] of [["02", 24380], ["04", 26100], ["06", 22050], ["08", 25600]] as const) {
    await addExpense({ supplier: S.luz, supplierName: "Eléctrica del Centro S.A.", supplierNif: "A30000003", cat: "G03", date: `2026-${m}-12`, concept: "Suministro eléctrico zonas comunes (bimestral)", base, vatPct: 21 });
  }
  await addExpense({ supplier: S.seguro, supplierName: "Seguros La Previsora S.A.", supplierNif: "A30000005", cat: "G05", date: "2026-02-01", concept: "Prima anual seguro multirriesgo comunidades 2026 (exenta de IVA)", base: 153420, vatPct: 0 });
  await addExpense({ supplier: S.fontaneria, supplierName: "Fontanería Rápida S.L.", supplierNif: "B30000008", cat: "G10", date: "2026-03-18", concept: "Reparación de fuga en cuarto de contadores", base: 21000, vatPct: 21 });
  await addExpense({ supplier: S.obras, supplierName: "Construcciones y Reformas Olmo S.L.", supplierNif: "B30000009", cat: "G10", date: "2026-06-08", concept: "Sustitución de bajante general (con cargo al fondo de reserva)", base: 150000, vatPct: 21, reserve: true });
  await addExpense({ supplier: S.abogado, supplierName: "Ortega & Asociados Abogados", supplierNif: nif(66778899), cat: "G13", date: "2026-09-15", concept: "Honorarios procedimiento monitorio contra el propietario del 2ºC (Miguel Torres Castillo)", base: 30000, vatPct: 21, irpfPct: 15, restricted: true });
  void S.antena;

  // ---------- Documentos comunes ----------
  const docs: [string, string, string, string][] = [
    ["acta", "Acta de la junta general ordinaria de 15/12/2025", "2025-12-15",
      `En Villanueva del Ejemplo, a 15 de diciembre de 2025, se reúne en segunda convocatoria la junta general ordinaria de la ${COMMUNITY_NAME}.\n\nOrden del día:\n1. Aprobación de la liquidación de cuentas del ejercicio 2025.\n2. Aprobación del presupuesto ordinario para 2026 (18.300,00 €) y de la aportación al fondo de reserva.\n3. Incremento del 20 % en la participación en gastos comunes del 3ºC por su destino a uso turístico (art. 17.12 LPH).\n4. Renovación de cargos: se nombra presidenta a Lucía Fernández Molina (2ºB).\n5. Ruegos y preguntas.\n\nTodos los acuerdos se aprueban por las mayorías exigidas en la Ley de Propiedad Horizontal.\n\n(Documento ficticio de ejemplo)`],
    ["estatutos", "Estatutos de la comunidad", "1998-05-20",
      `Estatutos de la ${COMMUNITY_NAME}.\n\nArtículo 1. Los gastos generales se distribuirán conforme a la cuota de participación de cada inmueble, salvo los de ascensor, que solo abonarán las viviendas, y los de la puerta del garaje, que solo abonarán las plazas de garaje.\n\nArtículo 2. Las cuotas se abonarán por trimestres naturales anticipados.\n\n(Documento ficticio de ejemplo)`],
    ["seguro", "Póliza de seguro multirriesgo 2026", "2026-02-01",
      "Condiciones particulares de la póliza de seguro multirriesgo de comunidades. Capital continente: 2.500.000,00 €. Responsabilidad civil: 600.000,00 €.\n\n(Documento ficticio de ejemplo)"],
    ["contrato", "Contrato de mantenimiento del ascensor", "2024-01-01",
      "Contrato de mantenimiento integral del aparato elevador suscrito con Ascensores Elevia S.A. Duración: 3 años.\n\n(Documento ficticio de ejemplo)"],
  ];
  for (const [kind, title, date, body] of docs) {
    const path = `${cid}/documentos/${kind}-${date}.pdf`;
    const bytes = await textPdf(title, COMMUNITY_NAME, body);
    uploads.push({ path, bytes });
    await insert(db, "documents", { community_id: cid, kind, title, doc_date: date, storage_path: path, mime_type: "application/pdf", size_bytes: bytes.length, uploaded_by: users.admin });
  }
  return cid;
}

async function buildPinos(db: Client, users: Record<UserKey, string>) {
  console.log(`→ Creando «${COMMUNITY2_NAME}» (segunda comunidad, para probar el multi-comunidad)`);
  const c = { name: COMMUNITY2_NAME, cif: "H87654321", address: "Avenida de los Pinos, 3", postal_code: "28998", city: "Villanueva del Ejemplo", province: "Madrid", region: "Comunidad de Madrid" };
  const cid = await insert(db, "communities", { ...c, privacy_policy: defaultPrivacyPolicy(c), created_by: users.admin });
  await db.query("select init_community($1, $2)", [cid, users.admin]);
  await insert(db, "bank_accounts", { community_id: cid, name: "Cuenta principal", iban: "ES6000491500051234567892", is_default: true });
  const names = ["Marta Vidal Soler", "Jorge Pascual Ibáñez", "Nuria Campos Rey", "Óscar Blanco Lara"];
  for (let i = 0; i < 4; i++) {
    const pid = await insert(db, "properties", { community_id: cid, kind: "vivienda", code: `Casa ${i + 1}`, coefficient: "25.0000", sort_order: i + 1 });
    const oid = await insert(db, "owners", { community_id: cid, full_name: names[i], nif: nif(70000000 + i * 1111), email: `pinos${i + 1}@example.com` });
    await db.query("insert into ownerships (community_id, property_id, owner_id, start_date) values ($1,$2,$3,'2020-01-01')", [cid, pid, oid]);
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function hash(s: string): number {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

if (require.main === module) {
  seed().catch((e) => {
    console.error("✖", e.message);
    process.exit(1);
  });
}
