/** Generación de PDF en el servidor (recibos, facturas y documentos de ejemplo). */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatEuros } from "./money";
import { formatDate } from "./dates";

const INK = rgb(0.11, 0.16, 0.2);
const MUTED = rgb(0.4, 0.45, 0.5);
const BRAND = rgb(0.06, 0.46, 0.43);

// pdf-lib con fuentes estándar solo admite WinAnsi: sustituimos caracteres no representables.
const clean = (s: string) => s.replace(/ /g, " ").replace(/[^\x20-\x7E¡-ÿ€–—“”‘’…]/g, "");

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
}

async function start(): Promise<Ctx> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, page, font, bold, y: 790 };
}

function text(c: Ctx, s: string, x: number, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; right?: boolean } = {}) {
  const size = opts.size ?? 10;
  const f = opts.bold ? c.bold : c.font;
  const t = clean(s);
  const w = f.widthOfTextAtSize(t, size);
  c.page.drawText(t, { x: opts.right ? x - w : x, y: c.y, size, font: f, color: opts.color ?? INK });
}

function wrap(c: Ctx, s: string, x: number, maxWidth: number, size = 10) {
  for (const para of clean(s).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (c.font.widthOfTextAtSize(next, size) > maxWidth && line) {
        text(c, line, x, { size });
        c.y -= size + 4;
        line = word;
        if (c.y < 60) newPage(c);
      } else line = next;
    }
    text(c, line, x, { size });
    c.y -= size + 6;
    if (c.y < 60) newPage(c);
  }
}

function newPage(c: Ctx) {
  c.page = c.doc.addPage([595.28, 841.89]);
  c.y = 790;
}

function hr(c: Ctx) {
  c.page.drawLine({ start: { x: 50, y: c.y }, end: { x: 545, y: c.y }, thickness: 0.6, color: rgb(0.85, 0.87, 0.89) });
}

export interface InvoicePdfData {
  supplier: string;
  supplierNif?: string | null;
  supplierAddress?: string;
  number: string;
  date: string;
  customer: string;
  customerCif?: string | null;
  customerAddress?: string | null;
  concept: string;
  baseCents: number;
  vatPct: number;
  vatCents: number;
  irpfPct: number;
  irpfCents: number;
  totalCents: number;
}

/** Factura de proveedor (solo para los datos de ejemplo: simula una factura escaneada). */
export async function invoicePdf(d: InvoicePdfData): Promise<Uint8Array> {
  const c = await start();
  text(c, d.supplier, 50, { size: 16, bold: true });
  c.y -= 16;
  text(c, `NIF ${d.supplierNif ?? ""} · ${d.supplierAddress ?? "Polígono Industrial Ejemplo, nave 3"}`, 50, { size: 9, color: MUTED });
  c.y -= 40;
  text(c, "FACTURA", 50, { size: 22, bold: true, color: BRAND });
  text(c, `Nº ${d.number}`, 545, { size: 11, bold: true, right: true });
  c.y -= 16;
  text(c, `Fecha: ${formatDate(d.date)}`, 545, { size: 10, right: true });
  c.y -= 30;
  text(c, "Cliente", 50, { size: 9, color: MUTED });
  c.y -= 14;
  text(c, d.customer, 50, { bold: true });
  c.y -= 14;
  text(c, `CIF ${d.customerCif ?? ""}`, 50);
  c.y -= 14;
  text(c, d.customerAddress ?? "", 50);
  c.y -= 36;
  hr(c);
  c.y -= 16;
  text(c, "Concepto", 50, { bold: true });
  text(c, "Importe", 545, { bold: true, right: true });
  c.y -= 18;
  text(c, d.concept, 50);
  text(c, formatEuros(d.baseCents), 545, { right: true });
  c.y -= 30;
  hr(c);
  c.y -= 20;
  const row = (label: string, value: string, bold = false) => {
    text(c, label, 400, { bold, right: true });
    text(c, value, 545, { bold, right: true });
    c.y -= 16;
  };
  row("Base imponible", formatEuros(d.baseCents));
  row(`IVA ${d.vatPct} %`, formatEuros(d.vatCents));
  row("Total factura", formatEuros(d.totalCents), true);
  if (d.irpfCents > 0) {
    row(`Retención IRPF ${d.irpfPct} %`, `-${formatEuros(d.irpfCents)}`);
    row("Total a pagar", formatEuros(d.totalCents - d.irpfCents), true);
  }
  c.y = 60;
  text(c, "Documento ficticio generado como dato de ejemplo por Comunidad Fácil.", 50, { size: 8, color: MUTED });
  return c.doc.save();
}

/** Documento de texto (actas, estatutos, pólizas... de ejemplo). */
export async function textPdf(title: string, subtitle: string, body: string): Promise<Uint8Array> {
  const c = await start();
  text(c, title, 50, { size: 18, bold: true, color: BRAND });
  c.y -= 18;
  text(c, subtitle, 50, { size: 10, color: MUTED });
  c.y -= 30;
  wrap(c, body, 50, 495, 10);
  return c.doc.save();
}

export interface ReceiptPdfData {
  community: { name: string; cif?: string | null; address?: string | null; city?: string | null };
  code: string;
  concept: string;
  issueDate: string;
  dueDate: string;
  owner: { name: string; nif?: string | null };
  property: string;
  lines: { label: string; cents: number }[];
  totalCents: number;
  paidCents: number;
  iban?: string | null;
}

/** Recibo de cuota para el propietario. */
export async function receiptPdf(d: ReceiptPdfData): Promise<Uint8Array> {
  const c = await start();
  text(c, d.community.name, 50, { size: 14, bold: true });
  c.y -= 15;
  text(c, [d.community.cif && `CIF ${d.community.cif}`, d.community.address, d.community.city].filter(Boolean).join(" · "), 50, { size: 9, color: MUTED });
  c.y -= 40;
  text(c, "RECIBO", 50, { size: 22, bold: true, color: BRAND });
  text(c, `Nº ${d.code}`, 545, { size: 11, bold: true, right: true });
  c.y -= 16;
  text(c, `Emisión: ${formatDate(d.issueDate)} · Vencimiento: ${formatDate(d.dueDate)}`, 545, { size: 9, right: true });
  c.y -= 32;
  text(c, "Propietario", 50, { size: 9, color: MUTED });
  text(c, "Inmueble", 330, { size: 9, color: MUTED });
  c.y -= 14;
  text(c, d.owner.name, 50, { bold: true });
  text(c, d.property, 330, { bold: true });
  c.y -= 14;
  if (d.owner.nif) text(c, `NIF ${d.owner.nif}`, 50);
  c.y -= 30;
  hr(c);
  c.y -= 16;
  text(c, d.concept, 50, { bold: true });
  c.y -= 22;
  for (const l of d.lines) {
    text(c, l.label, 60);
    text(c, formatEuros(l.cents), 545, { right: true });
    c.y -= 16;
  }
  c.y -= 6;
  hr(c);
  c.y -= 20;
  text(c, "Total recibo", 400, { bold: true, right: true });
  text(c, formatEuros(d.totalCents), 545, { bold: true, right: true });
  c.y -= 20;
  const pending = d.totalCents - d.paidCents;
  const status = pending <= 0 ? "PAGADO" : d.paidCents > 0 ? `PAGO PARCIAL · pendiente ${formatEuros(pending)}` : "PENDIENTE DE PAGO";
  text(c, status, 545, { bold: true, right: true, color: pending <= 0 ? BRAND : rgb(0.7, 0.3, 0.05) });
  if (pending > 0 && d.iban) {
    c.y -= 30;
    text(c, `Puede abonarlo por transferencia a la cuenta de la comunidad: ${d.iban}`, 50, { size: 9 });
  }
  c.y = 60;
  text(c, "Recibo emitido con Comunidad Fácil. Conserve este documento como justificante.", 50, { size: 8, color: MUTED });
  return c.doc.save();
}
