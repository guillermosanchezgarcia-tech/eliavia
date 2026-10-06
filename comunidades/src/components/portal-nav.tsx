"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FolderOpen, Home, PieChart, Receipt, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pestañas del portal: barra inferior en el móvil y barra superior en escritorio. */
export function PortalNav({ cid, president }: { cid: string; president: boolean }) {
  const pathname = usePathname();
  const base = `/portal/${cid}`;
  const items = [
    { href: base, label: "Inicio", icon: Home, exact: true },
    { href: `${base}/pagos`, label: "Mis pagos", icon: Receipt },
    { href: `${base}/facturas`, label: "Facturas", icon: FileText },
    { href: `${base}/cuentas`, label: "Cuentas", icon: PieChart },
    { href: `${base}/documentos`, label: "Documentos", icon: FolderOpen },
    ...(president ? [{ href: `${base}/presidencia`, label: "Presidencia", icon: Shield }] : []),
  ];
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:static md:border-0 md:bg-transparent">
      <ul className="mx-auto flex max-w-4xl justify-around md:justify-start md:gap-1 md:px-4">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="min-w-0 flex-1 md:flex-none">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] sm:text-[11px] md:flex-row md:gap-2 md:rounded-lg md:px-3 md:text-sm",
                  active ? "text-primary md:bg-primary md:text-primary-foreground" : "text-muted-foreground hover:text-foreground md:hover:bg-muted"
                )}
              >
                <Icon className="size-5 md:size-4" />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
