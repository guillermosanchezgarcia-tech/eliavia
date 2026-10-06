import { Field, Input, Textarea } from "@/components/ui/input";
import type { Owner } from "@/lib/data";

export function OwnerFields({ o }: { o?: Owner }) {
  return (
    <>
      <Field label="Nombre y apellidos o razón social" className="sm:col-span-2"><Input name="full_name" defaultValue={o?.full_name} required /></Field>
      <Field label="NIF / CIF"><Input name="nif" defaultValue={o?.nif ?? ""} /></Field>
      <Field label="Teléfono"><Input name="phone" type="tel" defaultValue={o?.phone ?? ""} /></Field>
      <Field label="Email"><Input name="email" type="email" defaultValue={o?.email ?? ""} /></Field>
      <Field label="IBAN para domiciliación"><Input name="iban" defaultValue={o?.iban ?? ""} placeholder="ES00 0000 0000 0000 0000 0000" /></Field>
      <Field label="Dirección de notificaciones" className="sm:col-span-2"><Input name="address" defaultValue={o?.address ?? ""} /></Field>
      <Field label="Notas internas" className="sm:col-span-2"><Textarea name="notes" defaultValue={o?.notes ?? ""} className="min-h-16" /></Field>
    </>
  );
}
