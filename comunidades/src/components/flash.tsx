import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function Flash({ ok, error }: { ok?: string | string[]; error?: string | string[] }) {
  if (error) {
    return (
      <Alert variant="danger" className="mb-4 no-print">
        <AlertTriangle />
        <AlertDescription>{String(error)}</AlertDescription>
      </Alert>
    );
  }
  if (ok) {
    return (
      <Alert variant="success" className="mb-4 no-print">
        <CheckCircle2 />
        <AlertDescription>{String(ok)}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
