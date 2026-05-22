import * as XLSX from 'xlsx'
import type { Street } from '../types'
import { priorityLabels } from './priorityEngine'

const statusLabel: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En Revisión',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
}

const priorityColorHex: Record<string, string> = {
  MUY_ALTA: 'FFEF4444',
  ALTA: 'FFF97316',
  MEDIA: 'FFEAB308',
  BAJA: 'FF22C55E',
}

export function exportToExcel(streets: Street[], filename?: string) {
  const wb = XLSX.utils.book_new()

  // ── Hoja 1: Todas las calles ordenadas por score ──────────────────
  const allData = [...streets]
    .sort((a, b) => b.impact_score - a.impact_score)
    .map((s, i) => ({
      '#': i + 1,
      'Calle / Andador': s.street_name,
      Colonia: s.colonia,
      Prioridad: priorityLabels[s.priority],
      'Score (0-120)': s.impact_score,
      'Estado': statusLabel[s.status] ?? s.status,
      'Tipo de Vía': s.via_type,
      'Tipo de Tráfico': s.traffic_type,
      'Viviendas Beneficiadas': s.num_viviendas,
      'Longitud (m)': s.length_m,
      'Escuela Cercana': s.near_school ? 'Sí' : 'No',
      'Hospital Cercano': s.near_hospital ? 'Sí' : 'No',
      'Mercado Cercano': s.near_market ? 'Sí' : 'No',
      'Transporte Público': s.near_transport ? 'Sí' : 'No',
      'Riesgo Lluvias (1-5)': s.rain_risk,
      'Latitud': s.lat,
      'Longitud (coord)': s.lng,
      'Reportó': s.reporter_name,
      'Teléfono': s.reporter_phone,
      'Descripción': s.description,
      'Fecha Registro': new Date(s.created_at).toLocaleDateString('es-MX'),
    }))

  const ws1 = XLSX.utils.json_to_sheet(allData)
  ws1['!cols'] = [
    { wch: 4 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 12 },
    { wch: 15 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
    { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 40 }, { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(wb, ws1, 'Todas las Calles')

  // ── Hoja 2: Resumen por Colonia ───────────────────────────────────
  const coloniaMap: Record<string, Street[]> = {}
  streets.forEach(s => {
    if (!coloniaMap[s.colonia]) coloniaMap[s.colonia] = []
    coloniaMap[s.colonia].push(s)
  })

  const coloniaData = Object.entries(coloniaMap)
    .map(([colonia, items]) => ({
      Colonia: colonia,
      'N° Calles Registradas': items.length,
      'Total Familias Beneficiadas': items.reduce((a, b) => a + b.num_viviendas, 0),
      'Prioridad Muy Alta': items.filter(s => s.priority === 'MUY_ALTA').length,
      'Prioridad Alta': items.filter(s => s.priority === 'ALTA').length,
      'Prioridad Media': items.filter(s => s.priority === 'MEDIA').length,
      'Prioridad Baja': items.filter(s => s.priority === 'BAJA').length,
      'Score Promedio': Math.round(items.reduce((a, b) => a + b.impact_score, 0) / items.length),
      'Aprobadas': items.filter(s => s.status === 'APROBADO').length,
      'Pendientes': items.filter(s => s.status === 'PENDIENTE').length,
    }))
    .sort((a, b) => b['Score Promedio'] - a['Score Promedio'])

  const ws2 = XLSX.utils.json_to_sheet(coloniaData)
  ws2['!cols'] = [
    { wch: 22 }, { wch: 20 }, { wch: 25 }, { wch: 20 },
    { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen por Colonia')

  // ── Hoja 3: Solo Aprobadas ────────────────────────────────────────
  const approvedData = streets
    .filter(s => s.status === 'APROBADO')
    .sort((a, b) => b.impact_score - a.impact_score)
    .map((s, i) => ({
      '#': i + 1,
      'Calle / Andador': s.street_name,
      Colonia: s.colonia,
      Prioridad: priorityLabels[s.priority],
      'Score': s.impact_score,
      'Viviendas Beneficiadas': s.num_viviendas,
      'Longitud (m)': s.length_m,
      'Fecha Registro': new Date(s.created_at).toLocaleDateString('es-MX'),
      'Notas del Admin': s.admin_notes,
    }))

  const ws3 = XLSX.utils.json_to_sheet(approvedData)
  ws3['!cols'] = [
    { wch: 4 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 10 },
    { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 40 },
  ]
  XLSX.utils.book_append_sheet(wb, ws3, 'Aprobadas')

  // Guardar
  const date = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, filename ?? `priorizazihua_${date}.xlsx`)
}
