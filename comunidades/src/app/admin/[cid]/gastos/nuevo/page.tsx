import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { expenseOptions } from "@/lib/expense-options";
import { todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Card, CardContent } from "@/components/ui/card";
import { ExpenseForm } from "../expense-form";
import { createExpense } from "../actions";

export const metadata = { title: "Nuevo gasto" };

export default async function NewExpense({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  const o = await expenseOptions(supabase, cid);
  return (
    <>
      <PageHeader title="Nuevo gasto / factura" description="Sube la factura escaneada, revisa los importes y contabilízala." actions={<Link href={`/admin/${cid}/gastos`} className="text-sm text-primary underline">← Gastos</Link>} />
      <Flash ok={sp.ok} error={sp.error} />
      <Card>
        <CardContent className="pt-5">
          <ExpenseForm action={createExpense.bind(null, cid)} {...o} defaults={{ invoice_date: todayISO() }} submitLabel="Registrar gasto" />
        </CardContent>
      </Card>
    </>
  );
}
