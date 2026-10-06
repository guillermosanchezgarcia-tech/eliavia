import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Comunidad Fácil", template: "%s · Comunidad Fácil" },
  description: "Contabilidad de comunidades de propietarios y portal del propietario.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#12695f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-ES">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
