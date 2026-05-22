import { supabase } from './supabase'
import type { UserProfile } from '../types'

/** Obtiene el perfil del usuario autenticado */
export async function fetchMyProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data as UserProfile
}

/** Obtiene todos los perfiles — solo el admin debería llamar esto */
export async function fetchAllProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return []
  return data as UserProfile[]
}

/** Crea o actualiza un perfil de usuario */
export async function upsertProfile(profile: {
  user_id: string
  role: 'admin' | 'presidente_colonia'
  colonia?: string
  display_name?: string
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ ...profile, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return { error: error?.message ?? null }
}

/** Elimina / revoca un perfil de presidente */
export async function deleteProfile(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('user_profiles')
    .delete()
    .eq('user_id', userId)
  return { error: error?.message ?? null }
}

/** Busca un usuario de Supabase Auth por email (necesita service role en prod;
 *  en demo usamos la tabla user_profiles directamente) */
export async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  // Buscamos si ya tiene perfil con ese email guardado en display_name
  // En producción usar Supabase Admin API
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, display_name')
    .eq('display_name', email)
    .single()
  if (data) return { id: data.user_id, email: data.display_name ?? '' }
  return null
}
