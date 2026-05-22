import { supabase } from './supabase'

export type EmailNotificationType =
  | 'submitted'    // Reporte dado de alta
  | 'EN_REVISION'  // Pasó a revisión
  | 'APROBADO'     // Aprobado
  | 'RECHAZADO'    // Rechazado

export interface NotifyParams {
  to: string
  reporterName: string
  streetName: string
  colonia: string
  type: EmailNotificationType
  adminNotes?: string
}

/**
 * Llama a la Edge Function notify-citizen para enviar un correo al ciudadano.
 * Falla de forma silenciosa para no bloquear la UI si el servicio de email no está configurado.
 */
export async function notifyCitizen(params: NotifyParams): Promise<void> {
  if (!params.to || !params.to.includes('@')) return

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-citizen`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.warn('[notifyCitizen] Edge Function error:', err)
    }
  } catch (e) {
    // No bloquear la UI si el servicio de email falla
    console.warn('[notifyCitizen] Network error:', e)
  }
}
