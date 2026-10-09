/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_NOMBRE_OP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Fecha en que se generó esta versión de la app (AAAA-MM-DD). */
declare const __FECHA_VERSION__: string
