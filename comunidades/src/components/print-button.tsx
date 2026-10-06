"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Imprimir / PDF" }: { label?: string }) {
  return (
    <Button variant="outline" onClick={() => window.print()} type="button">
      <Printer /> {label}
    </Button>
  );
}
