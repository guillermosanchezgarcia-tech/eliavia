import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Lee un campo de texto de un formulario (vacío → null). */
export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

/** Mensaje de error legible a partir de un error de Supabase/PostgreSQL. */
export function friendlyError(e: { message?: string; code?: string } | null | undefined): string {
  const msg = e?.message ?? "Error desconocido";
  if (/row-level security|permission denied|No autorizado/.test(msg)) return "No tienes permiso para realizar esta acción.";
  if (/duplicate key/.test(msg)) return "Ya existe un registro con esos datos.";
  if (/violates foreign key/.test(msg)) return "No se puede borrar: hay otros datos que dependen de este registro.";
  return msg;
}

/** "7,5" → "7.5" (número decimal para la base de datos) o null si no es válido. */
export function decimalInput(fd: FormData, key: string, maxDecimals = 4): string | null {
  const s = str(fd, key)?.replace(",", ".");
  if (!s) return null;
  return new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`).test(s) ? s : null;
}
