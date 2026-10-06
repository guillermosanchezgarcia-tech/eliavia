import { Checkbox, Field, Input } from "@/components/ui/input";

export interface Supplier {
  id: string;
  name: string;
  nif: string | null;
  category: string | null;
  iban: string | null;
  email: string | null;
  phone: string | null;
  applies_withholding: boolean;
  withholding_pct: string;
  is_utility: boolean;
  notes: string | null;
}

export function SupplierFields({ s }: { s?: Supplier }) {
  return (
    <>
      <Field label="Nombre o razón social" className="sm:col-span-2"><Input name="name" defaultValue={s?.name} required /></Field>
      <Field label="NIF / CIF"><Input name="nif" defaultValue={s?.nif ?? ""} /></Field>
      <Field label="Categoría"><Input name="category" defaultValue={s?.category ?? ""} placeholder="Limpieza, Ascensor, Suministros…" /></Field>
      <Field label="IBAN"><Input name="iban" defaultValue={s?.iban ?? ""} /></Field>
      <Field label="Email"><Input name="email" type="email" defaultValue={s?.email ?? ""} /></Field>
      <Field label="Teléfono"><Input name="phone" defaultValue={s?.phone ?? ""} /></Field>
      <Field label="% de retención IRPF habitual" hint="Profesionales (administrador, abogado, arquitecto…): normalmente 15 %.">
        <Input name="withholding_pct" defaultValue={s ? String(Number(s.withholding_pct)).replace(".", ",") : "15"} inputMode="decimal" />
      </Field>
      <div className="grid gap-2 sm:col-span-2">
        <Checkbox name="applies_withholding" defaultChecked={s?.applies_withholding} label="Se le practica retención de IRPF (modelos 111 y 190)" />
        <Checkbox name="is_utility" defaultChecked={s?.is_utility} label="Suministro de agua, luz o combustible (se excluye del modelo 347)" />
      </div>
    </>
  );
}
