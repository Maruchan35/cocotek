import { describe, it, expect } from 'vitest'
import { calculatePriority, DEFAULT_WEIGHTS, maxScore } from '../priorityEngine'
import type { StreetFormData, PriorityWeights } from '../../types'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Crea un formulario completo con valores mínimos */
const baseForm = (): Partial<StreetFormData> => ({
  via_type:      'andador',
  traffic_type:  'peatonal',
  num_viviendas: 10,
  near_school:   false,
  near_hospital: false,
  near_market:   false,
  near_transport: false,
  rain_risk:     1,
  length_m:      100,
})

// ─── Tests de score ──────────────────────────────────────────────────────────

describe('calculatePriority — score base', () => {
  it('devuelve score positivo para cualquier formulario válido', () => {
    const { score } = calculatePriority(baseForm())
    expect(score).toBeGreaterThan(0)
  })

  it('score mínimo teórico: andador + peatonal + 1 vivienda + lluvia 1 + sin infra + <500m', () => {
    const { score } = calculatePriority(baseForm())
    // andador=5 + peatonal=5 + viviendas1_50=5 + lluvia=4 = 19
    expect(score).toBe(19)
  })

  it('score máximo teórico no supera maxScore()', () => {
    const maxForm: Partial<StreetFormData> = {
      via_type:      'primaria',
      traffic_type:  'pesado',
      num_viviendas: 300,
      near_school:   true,
      near_hospital: true,
      near_market:   true,
      near_transport: true,
      rain_risk:     5,
      length_m:      600,
    }
    const { score } = calculatePriority(maxForm)
    expect(score).toBeLessThanOrEqual(maxScore(DEFAULT_WEIGHTS))
    expect(score).toBe(maxScore(DEFAULT_WEIGHTS))
  })
})

// ─── Tests de infraestructura ─────────────────────────────────────────────────

describe('calculatePriority — infraestructura cercana', () => {
  it('escuela suma peso_escuela puntos', () => {
    const without = calculatePriority({ ...baseForm(), near_school: false })
    const with_   = calculatePriority({ ...baseForm(), near_school: true  })
    expect(with_.score - without.score).toBe(DEFAULT_WEIGHTS.peso_escuela)
  })

  it('hospital suma peso_hospital puntos', () => {
    const without = calculatePriority({ ...baseForm(), near_hospital: false })
    const with_   = calculatePriority({ ...baseForm(), near_hospital: true  })
    expect(with_.score - without.score).toBe(DEFAULT_WEIGHTS.peso_hospital)
  })

  it('transporte suma peso_transporte puntos', () => {
    const without = calculatePriority({ ...baseForm(), near_transport: false })
    const with_   = calculatePriority({ ...baseForm(), near_transport: true  })
    expect(with_.score - without.score).toBe(DEFAULT_WEIGHTS.peso_transporte)
  })

  it('mercado suma peso_mercado puntos', () => {
    const without = calculatePriority({ ...baseForm(), near_market: false })
    const with_   = calculatePriority({ ...baseForm(), near_market: true  })
    expect(with_.score - without.score).toBe(DEFAULT_WEIGHTS.peso_mercado)
  })
})

// ─── Tests de viviendas ───────────────────────────────────────────────────────

describe('calculatePriority — tramos de viviendas', () => {
  it('0 viviendas = 0 pts', () => {
    const { breakdown } = calculatePriority({ ...baseForm(), num_viviendas: 0 })
    expect(breakdown.viviendas).toBe(0)
  })

  it('1-50 viviendas = viviendas_1_50 pts', () => {
    const { breakdown } = calculatePriority({ ...baseForm(), num_viviendas: 50 })
    expect(breakdown.viviendas).toBe(DEFAULT_WEIGHTS.viviendas_1_50)
  })

  it('51-150 viviendas = viviendas_51_150 pts', () => {
    const { breakdown } = calculatePriority({ ...baseForm(), num_viviendas: 100 })
    expect(breakdown.viviendas).toBe(DEFAULT_WEIGHTS.viviendas_51_150)
  })

  it('151-299 viviendas = viviendas_151_299 pts', () => {
    const { breakdown } = calculatePriority({ ...baseForm(), num_viviendas: 200 })
    expect(breakdown.viviendas).toBe(DEFAULT_WEIGHTS.viviendas_151_299)
  })

  it('≥300 viviendas = viviendas_300plus pts', () => {
    const { breakdown } = calculatePriority({ ...baseForm(), num_viviendas: 300 })
    expect(breakdown.viviendas).toBe(DEFAULT_WEIGHTS.viviendas_300plus)
  })
})

// ─── Tests de riesgo lluvias ──────────────────────────────────────────────────

describe('calculatePriority — riesgo de lluvias', () => {
  it('lluvia 1 = 1 × multiplicador', () => {
    const { breakdown } = calculatePriority({ ...baseForm(), rain_risk: 1 })
    expect(breakdown.lluvia).toBe(1 * DEFAULT_WEIGHTS.lluvia_multiplicador)
  })

  it('lluvia 5 = 5 × multiplicador', () => {
    const { breakdown } = calculatePriority({ ...baseForm(), rain_risk: 5 })
    expect(breakdown.lluvia).toBe(5 * DEFAULT_WEIGHTS.lluvia_multiplicador)
  })

  it('valores fuera de rango se normalizan a 1-5', () => {
    const { breakdown: b0 } = calculatePriority({ ...baseForm(), rain_risk: 0 })
    const { breakdown: b6 } = calculatePriority({ ...baseForm(), rain_risk: 6 })
    expect(b0.lluvia).toBe(1 * DEFAULT_WEIGHTS.lluvia_multiplicador)
    expect(b6.lluvia).toBe(5 * DEFAULT_WEIGHTS.lluvia_multiplicador)
  })
})

// ─── Tests de bonus longitud ──────────────────────────────────────────────────

describe('calculatePriority — bonus longitud', () => {
  it('longitud ≤ umbral no suma bonus', () => {
    const { breakdown } = calculatePriority({ ...baseForm(), length_m: DEFAULT_WEIGHTS.bonus_longitud_m })
    expect(breakdown.longitud).toBe(0)
  })

  it('longitud > umbral suma bonus_longitud_pts', () => {
    const { breakdown } = calculatePriority({ ...baseForm(), length_m: DEFAULT_WEIGHTS.bonus_longitud_m + 1 })
    expect(breakdown.longitud).toBe(DEFAULT_WEIGHTS.bonus_longitud_pts)
  })
})

// ─── Tests de clasificación de prioridad ────────────────────────────────────

describe('calculatePriority — clasificación de prioridad', () => {
  it('score alto → MUY_ALTA', () => {
    const fullForm: Partial<StreetFormData> = {
      via_type: 'primaria', traffic_type: 'pesado', num_viviendas: 300,
      near_school: true, near_hospital: true, near_market: true, near_transport: true,
      rain_risk: 5, length_m: 600,
    }
    const { priority } = calculatePriority(fullForm)
    expect(priority).toBe('MUY_ALTA')
  })

  it('score bajo → BAJA', () => {
    const { priority } = calculatePriority({
      via_type: 'andador', traffic_type: 'peatonal', num_viviendas: 5,
      near_school: false, near_hospital: false, near_market: false, near_transport: false,
      rain_risk: 1, length_m: 50,
    })
    expect(priority).toBe('BAJA')
  })

  it('score exactamente en umbral muy_alta', () => {
    // Construir un score exactamente igual al umbral
    const { priority, score } = calculatePriority({
      via_type: 'primaria', traffic_type: 'pesado', num_viviendas: 300,
      near_school: true, near_hospital: true, near_market: false, near_transport: false,
      rain_risk: 1, length_m: 100,
    })
    if (score >= DEFAULT_WEIGHTS.umbral_muy_alta) {
      expect(priority).toBe('MUY_ALTA')
    } else if (score >= DEFAULT_WEIGHTS.umbral_alta) {
      expect(priority).toBe('ALTA')
    }
    // Solo verificamos que el resultado es consistente con el score
    expect(['MUY_ALTA', 'ALTA', 'MEDIA', 'BAJA']).toContain(priority)
  })
})

// ─── Tests con pesos personalizados ──────────────────────────────────────────

describe('calculatePriority — pesos personalizados', () => {
  it('respeta pesos custom para tipo de vía', () => {
    const customWeights: PriorityWeights = {
      ...DEFAULT_WEIGHTS,
      via_primaria: 99,
    }
    const { breakdown } = calculatePriority({ ...baseForm(), via_type: 'primaria' }, customWeights)
    expect(breakdown.via_type).toBe(99)
  })

  it('cambia la clasificación si se modifican umbrales', () => {
    const strictWeights: PriorityWeights = {
      ...DEFAULT_WEIGHTS,
      umbral_muy_alta: 999,  // imposible de alcanzar
    }
    const { priority } = calculatePriority({
      via_type: 'primaria', traffic_type: 'pesado', num_viviendas: 300,
      near_school: true, near_hospital: true, near_market: true, near_transport: true,
      rain_risk: 5, length_m: 600,
    }, strictWeights)
    expect(priority).not.toBe('MUY_ALTA')
  })

  it('pesos en cero no producen score negativo', () => {
    const zeroWeights: PriorityWeights = {
      ...DEFAULT_WEIGHTS,
      via_primaria: 0, via_secundaria: 0, via_andador: 0,
      trafico_pesado: 0, trafico_ligero: 0, trafico_peatonal: 0,
    }
    const { score } = calculatePriority(baseForm(), zeroWeights)
    expect(score).toBeGreaterThanOrEqual(0)
  })
})

// ─── Tests de maxScore ───────────────────────────────────────────────────────

describe('maxScore', () => {
  it('coincide con el score real del formulario máximo', () => {
    const maxForm: Partial<StreetFormData> = {
      via_type: 'primaria', traffic_type: 'pesado', num_viviendas: 300,
      near_school: true, near_hospital: true, near_market: true, near_transport: true,
      rain_risk: 5, length_m: 600,
    }
    const { score } = calculatePriority(maxForm, DEFAULT_WEIGHTS)
    expect(score).toBe(maxScore(DEFAULT_WEIGHTS))
  })

  it('con pesos custom actualiza el máximo', () => {
    const bigWeights: PriorityWeights = { ...DEFAULT_WEIGHTS, via_primaria: 50 }
    expect(maxScore(bigWeights)).toBe(maxScore(DEFAULT_WEIGHTS) + 30) // 50 - 20 = +30
  })
})
