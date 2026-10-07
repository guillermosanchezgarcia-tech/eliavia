import { createClient } from '@supabase/supabase-js'
import { config } from '../config'

// Conexión con Supabase (base de datos, usuarios y fotos en la nube).
// Si aún no está configurado se crea con valores de relleno: la app muestra
// entonces la pantalla «Configuración pendiente» y nunca llega a usarla.
export const supabase = createClient(
  config.supabaseUrl || 'https://sin-configurar.supabase.co',
  config.supabaseKey || 'sin-configurar',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
