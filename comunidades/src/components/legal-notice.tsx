import Link from "next/link";

export function LegalNotice({ communityId }: { communityId?: string }) {
  return (
    <footer className="mt-12 border-t border-border pt-4 pb-8 text-xs leading-relaxed text-muted-foreground">
      <p>
        <strong>Aviso:</strong> Comunidad Fácil es una herramienta de gestión. No sustituye el asesoramiento de un administrador de
        fincas colegiado ni de un profesional jurídico. Referencia normativa: Ley 49/1960, de Propiedad Horizontal (texto consolidado
        BOE-A-1960-10906).
      </p>
      <p className="mt-1">
        <Link className="underline" href="/aviso-legal">Aviso legal</Link>
        {communityId ? (
          <>
            {" · "}
            <Link className="underline" href={`/privacidad/${communityId}`}>Política de privacidad de la comunidad</Link>
          </>
        ) : null}
      </p>
    </footer>
  );
}
