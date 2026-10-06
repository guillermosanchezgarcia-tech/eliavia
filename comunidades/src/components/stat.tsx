import * as React from "react";
import { cn } from "@/lib/utils";

export function Stat({ label, value, hint, tone = "default", icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "default" | "success" | "warning" | "danger"; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div
        className={cn("mt-1 text-2xl font-semibold tabular", {
          "text-success": tone === "success",
          "text-warning-foreground": tone === "warning",
          "text-destructive": tone === "danger",
        })}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
