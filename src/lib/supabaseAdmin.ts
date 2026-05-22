import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string

/**
 * Cliente con service role — solo usar en operaciones de administrador
 * (crear usuarios, leer auth.users, etc.)
 * NUNCA exponer este cliente a usuarios no autenticados.
 */
export const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null
