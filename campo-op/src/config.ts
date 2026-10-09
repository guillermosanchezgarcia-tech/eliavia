// Ajustes de la app. Los valores se leen de las «variables de entorno»
// (archivo .env.local en el ordenador, o el panel de Netlify en producción).

export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  nombreOP: import.meta.env.VITE_NOMBRE_OP || 'AGRO NATURE SAT',
  nombreApp: 'Campo OP',
}

export const configurado = Boolean(config.supabaseUrl && config.supabaseKey)
