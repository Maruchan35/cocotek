import type { StreetFormData, Priority, PriorityWeights } from '../types'

/** Pesos por defecto — reflejan los valores iniciales de la tabla priority_weights */
export const DEFAULT_WEIGHTS: PriorityWeights = {
  via_primaria: 20,
  via_secundaria: 10,
  via_andador: 5,

  trafico_pesado: 15,
  trafico_ligero: 10,
  trafico_peatonal: 5,

  viviendas_300plus: 20,
  viviendas_151_299: 15,
  viviendas_51_150: 10,
  viviendas_1_50: 5,

  peso_escuela: 15,
  peso_hospital: 15,
  peso_transporte: 10,
  peso_mercado: 5,

  lluvia_multiplicador: 4,

  bonus_longitud_m: 500,
  bonus_longitud_pts: 5,

  umbral_muy_alta: 91,
  umbral_alta: 61,
  umbral_media: 31,
}

export interface PriorityResult {
  score: number
  priority: Priority
  breakdown: Record<string, number>
}

/**
 * Calcula el score y la prioridad de un reporte de calle.
 *
 * @param data    Datos del formulario (puede ser parcial).
 * @param weights Pesos opcionales — si se omiten se usan DEFAULT_WEIGHTS.
 *                Permite que el admin configure los pesos desde el dashboard
 *                sin tocar código.
 */
export function calculatePriority(
  data: Partial<StreetFormData>,
  weights: PriorityWeights = DEFAULT_WEIGHTS,
): PriorityResult {
  const breakdown: Record<string, number> = {}

  // 1. Tipo de vía
  const viaScore: Record<string, number> = {
    primaria: weights.via_primaria,
    secundaria: weights.via_secundaria,
    andador: weights.via_andador,
  }
  breakdown.via_type = viaScore[data.via_type ?? ''] ?? 0

  // 2. Tipo de tráfico
  const trafficScore: Record<string, number> = {
    pesado: weights.trafico_pesado,
    ligero: weights.trafico_ligero,
    peatonal: weights.trafico_peatonal,
  }
  breakdown.traffic_type = trafficScore[data.traffic_type ?? ''] ?? 0

  // 3. Viviendas beneficiadas
  const v = data.num_viviendas ?? 0
  if      (v >= 300) breakdown.viviendas = weights.viviendas_300plus
  else if (v >= 151) breakdown.viviendas = weights.viviendas_151_299
  else if (v >= 51)  breakdown.viviendas = weights.viviendas_51_150
  else if (v >= 1)   breakdown.viviendas = weights.viviendas_1_50
  else               breakdown.viviendas = 0

  // 4. Infraestructura cercana
  breakdown.escuela    = data.near_school    ? weights.peso_escuela    : 0
  breakdown.hospital   = data.near_hospital  ? weights.peso_hospital   : 0
  breakdown.transporte = data.near_transport ? weights.peso_transporte : 0
  breakdown.mercado    = data.near_market    ? weights.peso_mercado    : 0

  // 5. Riesgo en lluvias (1-5) × multiplicador
  const rain = Math.min(5, Math.max(1, data.rain_risk ?? 1))
  breakdown.lluvia = rain * weights.lluvia_multiplicador

  // 6. Bonus por longitud
  breakdown.longitud =
    (data.length_m ?? 0) > weights.bonus_longitud_m ? weights.bonus_longitud_pts : 0

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0)

  // 7. Clasificación según umbrales configurables
  let priority: Priority
  if      (score >= weights.umbral_muy_alta) priority = 'MUY_ALTA'
  else if (score >= weights.umbral_alta)     priority = 'ALTA'
  else if (score >= weights.umbral_media)    priority = 'MEDIA'
  else                                       priority = 'BAJA'

  return { score, priority, breakdown }
}

export const priorityColors: Record<Priority, string> = {
  MUY_ALTA: '#ef4444',
  ALTA: '#f97316',
  MEDIA: '#eab308',
  BAJA: '#22c55e',
}

export const priorityLabels: Record<Priority, string> = {
  MUY_ALTA: 'Muy Alta',
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
}

/** Puntaje máximo teórico dado un conjunto de pesos */
export function maxScore(weights: PriorityWeights = DEFAULT_WEIGHTS): number {
  return (
    weights.via_primaria +
    weights.trafico_pesado +
    weights.viviendas_300plus +
    weights.peso_escuela +
    weights.peso_hospital +
    weights.peso_transporte +
    weights.peso_mercado +
    5 * weights.lluvia_multiplicador +
    weights.bonus_longitud_pts
  )
}
