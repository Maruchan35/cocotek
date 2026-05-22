import { supabase } from './supabase'
import { DEFAULT_WEIGHTS } from './priorityEngine'
import type { PriorityWeights } from '../types'

/**
 * Obtiene los pesos de priorización desde Supabase.
 * Si la tabla está vacía o hay un error, devuelve los pesos por defecto.
 */
export async function fetchWeights(): Promise<PriorityWeights> {
  const { data, error } = await supabase
    .from('priority_weights')
    .select('*')
    .limit(1)
    .single()

  if (error || !data) {
    console.warn('[Weights] Usando pesos por defecto:', error?.message)
    return { ...DEFAULT_WEIGHTS }
  }

  return data as PriorityWeights
}

/**
 * Guarda los pesos actualizados en Supabase.
 * Solo puede ejecutarse con un usuario autenticado (admin).
 *
 * @returns true si se guardó correctamente, false si hubo error.
 */
export async function saveWeights(weights: PriorityWeights): Promise<boolean> {
  if (!weights.id) {
    console.error('[Weights] No se puede guardar sin ID')
    return false
  }

  const { error } = await supabase
    .from('priority_weights')
    .update({
      ...weights,
      updated_at: new Date().toISOString(),
    })
    .eq('id', weights.id)

  if (error) {
    console.error('[Weights] Error al guardar pesos:', error.message)
    return false
  }

  return true
}

/** Etiquetas legibles para cada campo de peso */
export const WEIGHT_LABELS: Record<keyof Omit<PriorityWeights, 'id' | 'updated_at'>, string> = {
  via_primaria:        'Vía primaria (pts)',
  via_secundaria:      'Vía secundaria (pts)',
  via_andador:         'Andador (pts)',
  trafico_pesado:      'Tráfico pesado (pts)',
  trafico_ligero:      'Tráfico ligero (pts)',
  trafico_peatonal:    'Tráfico peatonal (pts)',
  viviendas_300plus:   'Viviendas ≥300 (pts)',
  viviendas_151_299:   'Viviendas 151-299 (pts)',
  viviendas_51_150:    'Viviendas 51-150 (pts)',
  viviendas_1_50:      'Viviendas 1-50 (pts)',
  peso_escuela:        'Escuela cercana (pts)',
  peso_hospital:       'Hospital cercano (pts)',
  peso_transporte:     'Transporte público (pts)',
  peso_mercado:        'Mercado cercano (pts)',
  lluvia_multiplicador:'Multiplicador riesgo lluvias',
  bonus_longitud_m:    'Umbral longitud bonus (m)',
  bonus_longitud_pts:  'Bonus longitud (pts)',
  umbral_muy_alta:     'Umbral Muy Alta (pts)',
  umbral_alta:         'Umbral Alta (pts)',
  umbral_media:        'Umbral Media (pts)',
}

/** Grupos para mostrarlos organizados en el formulario */
export const WEIGHT_GROUPS: { label: string; keys: (keyof PriorityWeights)[] }[] = [
  {
    label: 'Tipo de Vía',
    keys: ['via_primaria', 'via_secundaria', 'via_andador'],
  },
  {
    label: 'Tipo de Tráfico',
    keys: ['trafico_pesado', 'trafico_ligero', 'trafico_peatonal'],
  },
  {
    label: 'Viviendas Beneficiadas',
    keys: ['viviendas_300plus', 'viviendas_151_299', 'viviendas_51_150', 'viviendas_1_50'],
  },
  {
    label: 'Infraestructura Cercana',
    keys: ['peso_escuela', 'peso_hospital', 'peso_transporte', 'peso_mercado'],
  },
  {
    label: 'Riesgo de Lluvias',
    keys: ['lluvia_multiplicador'],
  },
  {
    label: 'Bonus por Longitud',
    keys: ['bonus_longitud_m', 'bonus_longitud_pts'],
  },
  {
    label: 'Umbrales de Clasificación',
    keys: ['umbral_muy_alta', 'umbral_alta', 'umbral_media'],
  },
]
