"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Botón de envío que se desactiva mientras se guarda. Con `confirm` pide confirmación antes. */
export function SubmitButton({ children, pendingText = "Guardando…", confirm: confirmText, ...props }: ButtonProps & { pendingText?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || props.disabled}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      {...props}
    >
      {pending ? pendingText : children}
    </Button>
  );
}
