export type ViaType = 'andador' | 'secundaria' | 'primaria'
export type TrafficType = 'peatonal' | 'ligero' | 'pesado'
export type Priority = 'BAJA' | 'MEDIA' | 'ALTA' | 'MUY_ALTA'
export type Status = 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO'
export type UserRole = 'admin' | 'presidente_colonia'

export interface UserProfile {
  id: string
  user_id: string
  role: UserRole
  colonia: string | null
  display_name: string | null
  created_at: string
  updated_at?: string
}

export interface Street {
  id: string
  created_at: string
  street_name: string
  colonia: string
  lat: number
  lng: number
  length_m: number
  via_type: ViaType
  traffic_type: TrafficType
  num_viviendas: number
  near_school: boolean
  near_hospital: boolean
  near_market: boolean
  near_transport: boolean
  rain_risk: number // 1-5
  description: string
  photo_urls: string[]
  impact_score: number
  priority: Priority
  status: Status
  admin_notes: string
  reporter_name: string
  reporter_email: string
  reporter_phone: string
}

export interface StreetFormData {
  zone_type: 'URBANA' | 'RURAL'
  street_name: string
  colonia: string
  lat: number | null
  lng: number | null
  length_m: number
  via_type: ViaType | ''
  traffic_type: TrafficType | ''
  num_viviendas: number
  near_school: boolean
  near_hospital: boolean
  near_market: boolean
  near_transport: boolean
  rain_risk: number
  description: string
  reporter_name: string
  reporter_email: string
  reporter_phone: string
  photos: File[]
}

export interface ColoniaStats {
  colonia: string
  total_calles: number
  total_viviendas: number
  muy_alta: number
  alta: number
  media: number
  baja: number
  avg_score: number
}

/** Pesos del algoritmo de priorización — corresponden a la tabla priority_weights en Supabase */
export interface PriorityWeights {
  id?: string
  updated_at?: string

  // Tipo de vía
  via_primaria: number
  via_secundaria: number
  via_andador: number

  // Tipo de tráfico
  trafico_pesado: number
  trafico_ligero: number
  trafico_peatonal: number

  // Viviendas (tramos)
  viviendas_300plus: number
  viviendas_151_299: number
  viviendas_51_150: number
  viviendas_1_50: number

  // Infraestructura cercana
  peso_escuela: number
  peso_hospital: number
  peso_transporte: number
  peso_mercado: number

  // Riesgo lluvias
  lluvia_multiplicador: number

  // Bonus longitud
  bonus_longitud_m: number
  bonus_longitud_pts: number

  // Umbrales de clasificación
  umbral_muy_alta: number
  umbral_alta: number
  umbral_media: number
}

/** Entrada de historial de cambios de estado */
export interface StatusHistoryEntry {
  id: string
  created_at: string
  street_id: string
  old_status: Status | null
  new_status: Status
  changed_by: string
  notes: string
}
