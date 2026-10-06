"use client";

import { useState } from "react";
import { centsToInput, formatEuros, parseEuros, pctOf } from "@/lib/money";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";

interface Option { id: string; name: string }
interface SupplierOpt extends Option { applies_withholding: boolean; withholding_pct: string }

export interface ExpenseDefaults {
  supplier_id?: string | null;
  category_id?: string;
  allocation_key_id?: string | null;
  invoice_number?: string | null;
  invoice_date?: string;
  description?: string | null;
  base_cents?: number;
  vat_pct?: string;
  vat_cents?: number;
  irpf_pct?: string;
  irpf_cents?: number;
  charged_to_reserve?: boolean;
  restricted?: boolean;
  paid_date?: string | null;
  paid_bank_account_id?: string | null;
}

const pct = (s: string | undefined, d: string) => (s == null ? d : String(Number(s)).replace(".", ","));

/** Formulario de gasto: calcula IVA, retención IRPF, total y líquido a pagar mientras se escribe. */
export function ExpenseForm({
  action, suppliers, categories, keys, banks, defaults = {}, withFile = true, submitLabel,
}: {
  action: (fd: FormData) => void | Promise<void>;
  suppliers: SupplierOpt[];
  categories: Option[];
  keys: Option[];
  banks: Option[];
  defaults?: ExpenseDefaults;
  withFile?: boolean;
  submitLabel: string;
}) {
  const [base, setBase] = useState(defaults.base_cents != null ? centsToInput(defaults.base_cents) : "");
  const [vatPct, setVatPct] = useState(pct(defaults.vat_pct, "21"));
  const [irpfPct, setIrpfPct] = useState(pct(defaults.irpf_pct, "0"));
  const [vat, setVat] = useState(defaults.vat_cents != null ? centsToInput(defaults.vat_cents) : "");
  const [irpf, setIrpf] = useState(defaults.irpf_cents != null ? centsToInput(defaults.irpf_cents) : "");
  const [paid, setPaid] = useState(!!defaults.paid_date);

  const baseC = parseEuros(base) ?? 0;
  const recalc = (b: string, v: string, i: string) => {
    const bc = parseEuros(b) ?? 0;
    setVat(centsToInput(pctOf(bc, Number(v.replace(",", ".")) || 0)));
    setIrpf(centsToInput(pctOf(bc, Number(i.replace(",", ".")) || 0)));
  };
  const vatC = parseEuros(vat) ?? 0;
  const irpfC = parseEuros(irpf) ?? 0;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {withFile ? (
        <Field label="Factura escaneada (PDF, JPG, PNG o foto del móvil)" className="sm:col-span-2" hint="Máximo 10 MB. Se guarda en un almacenamiento privado.">
          <Input type="file" name="file" accept="application/pdf,image/*" />
        </Field>
      ) : null}
      <Field label="Proveedor">
        <Select
          name="supplier_id"
          defaultValue={defaults.supplier_id ?? ""}
          onChange={(e) => {
            const s = suppliers.find((x) => x.id === e.target.value);
            const p = s?.applies_withholding ? String(Number(s.withholding_pct)).replace(".", ",") : "0";
            setIrpfPct(p);
            recalc(base, vatPct, p);
          }}
        >
          <option value="">— Sin proveedor —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>
      <Field label="Nº de factura"><Input name="invoice_number" defaultValue={defaults.invoice_number ?? ""} /></Field>
      <Field label="Fecha de la factura"><Input type="date" name="invoice_date" defaultValue={defaults.invoice_date} required /></Field>
      <Field label="Partida">
        <Select name="category_id" defaultValue={defaults.category_id ?? ""} required>
          <option value="" disabled>Elige…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label="Concepto" className="sm:col-span-2"><Textarea name="description" defaultValue={defaults.description ?? ""} className="min-h-16" /></Field>

      <div className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:col-span-2 sm:grid-cols-3">
        <Field label="Base imponible (€)"><Input name="base" value={base} onChange={(e) => { setBase(e.target.value); recalc(e.target.value, vatPct, irpfPct); }} inputMode="decimal" required /></Field>
        <Field label="% IVA"><Input name="vat_pct" value={vatPct} onChange={(e) => { setVatPct(e.target.value); recalc(base, e.target.value, irpfPct); }} inputMode="decimal" /></Field>
        <Field label="Cuota IVA (€)"><Input name="vat_amount" value={vat} onChange={(e) => setVat(e.target.value)} inputMode="decimal" /></Field>
        <div className="hidden sm:block" />
        <Field label="% retención IRPF"><Input name="irpf_pct" value={irpfPct} onChange={(e) => { setIrpfPct(e.target.value); recalc(base, vatPct, e.target.value); }} inputMode="decimal" /></Field>
        <Field label="Cuota retención (€)"><Input name="irpf_amount" value={irpf} onChange={(e) => setIrpf(e.target.value)} inputMode="decimal" /></Field>
        <div className="grid gap-1 text-sm sm:col-span-3 sm:grid-cols-2">
          <div>Total factura: <strong className="tabular">{formatEuros(baseC + vatC)}</strong></div>
          <div>Líquido a pagar al proveedor: <strong className="tabular">{formatEuros(baseC + vatC - irpfC)}</strong></div>
        </div>
      </div>

      <Field label="Reparto">
        <Select name="allocation_key_id" defaultValue={defaults.allocation_key_id ?? keys[0]?.id}>
          {keys.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </Select>
      </Field>
      <div className="grid content-end gap-2">
        <Checkbox name="charged_to_reserve" defaultChecked={defaults.charged_to_reserve} label="Pago con cargo al fondo de reserva" />
        <Checkbox name="restricted" defaultChecked={defaults.restricted} label="Restringido: los propietarios no lo verán (contiene datos personales de terceros)" />
      </div>

      <div className="grid gap-3 rounded-lg border border-dashed p-3 sm:col-span-2 sm:grid-cols-2">
        <Checkbox name="is_paid" checked={paid} onChange={(e) => setPaid(e.target.checked)} label="Factura pagada" className="sm:col-span-2" />
        {paid ? (
          <>
            <Field label="Fecha de pago"><Input type="date" name="paid_date" defaultValue={defaults.paid_date ?? defaults.invoice_date} /></Field>
            <Field label="Cuenta de cargo">
              <Select name="paid_bank_account_id" defaultValue={defaults.paid_bank_account_id ?? banks[0]?.id}>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          </>
        ) : null}
      </div>
      <div className="sm:col-span-2"><SubmitButton>{submitLabel}</SubmitButton></div>
    </form>
  );
}
