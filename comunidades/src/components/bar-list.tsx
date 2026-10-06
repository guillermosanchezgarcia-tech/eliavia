import { formatEuros } from "@/lib/money";

/** Gráfico de barras horizontales (gastos por partida), sin librerías externas. */
export function BarList({ items, color = "var(--primary)" }: { items: { label: string; cents: number }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.cents));
  const total = items.reduce((a, i) => a + i.cents, 0);
  return (
    <ul className="grid gap-2.5">
      {items.map((i) => (
        <li key={i.label} className="grid gap-1">
          <div className="flex justify-between gap-2 text-sm">
            <span>{i.label}</span>
            <span className="tabular text-muted-foreground">
              {formatEuros(i.cents)} · {total ? ((i.cents / total) * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 }) : 0} %
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted">
            <div className="h-2.5 rounded-full" style={{ width: `${(i.cents / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
