import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { SideNav } from "@/components/side-nav";
import { LegalNotice } from "@/components/legal-notice";

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const { community, user } = await requireAdmin(cid);
  const base = `/admin/${cid}`;
  const items = [
    { href: base, label: "Resumen", exact: true },
    { href: `${base}/inmuebles`, label: "Inmuebles" },
    { href: `${base}/propietarios`, label: "Propietarios" },
    { href: `${base}/proveedores`, label: "Proveedores" },
    { href: `${base}/partidas`, label: "Partidas y repartos" },
    { href: `${base}/presupuestos`, label: "Presupuestos y derramas" },
    { href: `${base}/recibos`, label: "Recibos" },
    { href: `${base}/cobros`, label: "Cobros" },
    { href: `${base}/gastos`, label: "Gastos y facturas" },
    { href: `${base}/documentos`, label: "Documentos" },
    { href: `${base}/informes`, label: "Informes" },
    { href: `${base}/configuracion`, label: "Configuración" },
    { href: `${base}/auditoria`, label: "Auditoría" },
  ];
  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link href="/admin"><Logo /></Link>
          <span className="hidden text-muted-foreground sm:inline">/</span>
          <span className="truncate text-sm font-medium">{community.name}</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/admin" className="hidden text-muted-foreground hover:text-foreground sm:inline">Cambiar de comunidad</Link>
            <Link href={`/portal/${cid}`} className="hidden text-muted-foreground hover:text-foreground md:inline">Ver portal</Link>
            <form action="/auth/salir" method="post">
              <button className="text-muted-foreground hover:text-foreground" title={user.email}>Salir</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
        <aside className="no-print lg:w-56 lg:shrink-0">
          <div className="lg:sticky lg:top-20"><SideNav items={items} /></div>
        </aside>
        <main className="min-w-0 flex-1 print-full">
          {children}
          <LegalNotice communityId={cid} />
        </main>
      </div>
    </div>
  );
}
