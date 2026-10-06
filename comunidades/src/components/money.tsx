import { formatEuros } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Money({ cents, className, signed }: { cents: number | string | null | undefined; className?: string; signed?: boolean }) {
  const n = Number(cents ?? 0);
  return (
    <span className={cn("tabular whitespace-nowrap", signed && n > 0 && "text-destructive", signed && n < 0 && "text-success", className)}>
      {formatEuros(n)}
    </span>
  );
}
