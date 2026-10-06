import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { budgetVsActual, debtorsReport, incomeExpenseReport } from "@/lib/reports";
import { todayISO } from "@/lib/dates";

const EUR = '#,##0.00 "€"';

/** Exporta los informes a Excel. Solo administración y presidencia (lo comprueba la base de datos). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const sp = req.nextUrl.searchParams;
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("can_view_accounts", { p_community: cid });
  if (!allowed) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { data: community } = await supabase.from("communities").select("name").eq("id", cid).single();
  const today = todayISO();
  const from = sp.get("desde") ?? `${today.slice(0, 4)}-01-01`;
  const to = sp.get("hasta") ?? `${today.slice(0, 4)}-12-31`;
  const grain = (sp.get("agrupar") ?? "month") as "month" | "quarter" | "year";

  const report = await incomeExpenseReport(supabase, cid, from, to, grain);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Comunidad Fácil";

  const ws = wb.addWorksheet("Ingresos y gastos");
  ws.addRow([community?.name]).font = { bold: true, size: 13 };
  ws.addRow([`Del ${from.split("-").reverse().join("/")} al ${to.split("-").reverse().join("/")}`]);
  ws.addRow([]);
  const section = (title: string, items: { name: string; cents: number }[], total: number) => {
    ws.addRow([title, "Importe"]).font = { bold: true };
    for (const i of items) ws.addRow([i.name, i.cents / 100]);
    ws.addRow([`Total ${title.toLowerCase()}`, total / 100]).font = { bold: true };
    ws.addRow([]);
  };
  section("Ingresos", report.income, report.totalIncome);
  section("Gastos", report.expense, report.totalExpense);
  ws.addRow(["Resultado", (report.totalIncome - report.totalExpense) / 100]).font = { bold: true };
  ws.addRow([]);
  section("Fondo de reserva: aportaciones", report.reserveIn, report.totalReserveIn);
  section("Fondo de reserva: pagos", report.reserveOut, report.totalReserveOut);
  ws.getColumn(1).width = 45;
  ws.getColumn(2).width = 16;
  ws.getColumn(2).numFmt = EUR;

  const wp = wb.addWorksheet("Por periodos");
  wp.addRow(["Sección", "Partida", ...report.periods.map((p) => p.split("-").reverse().join("/")), "Total"]).font = { bold: true };
  const keys = [...new Map(report.rows.map((r) => [`${r.section}|${r.category_code}`, r])).values()];
  for (const k of keys) {
    const vals = report.periods.map((p) => report.rows.filter((r) => r.section === k.section && r.category_code === k.category_code && r.period_start === p).reduce((a, r) => a + r.amount_cents, 0) / 100);
    const label = { income: "Ingresos", expense: "Gastos", reserve_in: "Fondo (entradas)", reserve_out: "Fondo (salidas)" }[k.section];
    wp.addRow([label, k.category_name, ...vals, vals.reduce((a, v) => a + v, 0)]);
  }
  wp.columns.forEach((c, i) => { c.width = i < 2 ? 24 : 14; if (i >= 2) c.numFmt = EUR; });

  const budgetId = sp.get("presupuesto");
  if (budgetId) {
    const bva = await budgetVsActual(supabase, budgetId);
    const wbv = wb.addWorksheet("Presupuesto vs real");
    wbv.addRow(["Partida", "Presupuesto", "Real", "Desviación"]).font = { bold: true };
    for (const r of bva) wbv.addRow([r.category_name, r.budget_cents / 100, r.actual_cents / 100, (r.actual_cents - r.budget_cents) / 100]);
    wbv.columns.forEach((c, i) => { c.width = i === 0 ? 34 : 16; if (i) c.numFmt = EUR; });
  }

  const debtors = await debtorsReport(supabase, cid, today);
  const wd = wb.addWorksheet("Deudores (uso interno)");
  wd.addRow(["Información reservada: no publicar (protección de datos)."]).font = { italic: true };
  wd.addRow(["Propietario", "NIF", "0-30 días", "31-90", "91-180", "+180", "Total", "Desde"]).font = { bold: true };
  for (const d of debtors) wd.addRow([d.full_name, d.nif, ...d.buckets.map((b) => b / 100), d.total / 100, d.oldest.split("-").reverse().join("/")]);
  wd.columns.forEach((c, i) => { c.width = i === 0 ? 30 : 14; if (i >= 2 && i <= 6) c.numFmt = EUR; });

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="informe-${from}-${to}.xlsx"`,
    },
  });
}
