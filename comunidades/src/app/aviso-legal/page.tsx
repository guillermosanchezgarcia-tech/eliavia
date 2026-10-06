import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Aviso legal" };

export default function LegalPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/inicio" className="text-sm text-primary underline">← Volver</Link>
      <Card className="mt-4">
        <CardHeader><CardTitle>Aviso legal</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm leading-relaxed">
          <p>
            Comunidad Fácil es una herramienta informática de apoyo a la gestión contable de comunidades de propietarios. Los cálculos,
            informes y certificados que genera son orientativos y deben ser revisados por la persona que ejerce la administración.
          </p>
          <p>
            <strong>No sustituye el asesoramiento de un administrador de fincas colegiado</strong> ni el de un profesional jurídico o fiscal.
            Para cualquier duda sobre la aplicación de la Ley 49/1960, de 21 de julio, sobre Propiedad Horizontal (texto consolidado en el
            BOE, referencia BOE-A-1960-10906), consulte con el Colegio de Administradores de Fincas de su territorio.
          </p>
          <p>
            En Cataluña rige el Libro V del Código Civil de Cataluña, con reglas propias (por ejemplo, un fondo de reserva mínimo del 5 %).
            El porcentaje del fondo de reserva se puede configurar en cada comunidad.
          </p>
          <p>La aplicación no presenta modelos tributarios: solo prepara los datos para que el profesional los revise y presente.</p>
        </CardContent>
      </Card>
    </main>
  );
}
