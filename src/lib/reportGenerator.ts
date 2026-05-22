/**
 * reportGenerator.ts
 * Genera reportes periódicos en Excel (.xlsx) con gráficas Chart.js incrustadas.
 * Usa ExcelJS para imágenes y xlsx para el resto de las hojas.
 */
import ExcelJS from 'exceljs'
import type { Street } from '../types'

export type ReportPeriod = 'diario' | 'semanal' | 'mensual' | 'bimestral' | 'semestral' | 'anual' | 'personalizado'

export interface ReportConfig {
  period: ReportPeriod
  dateFrom?: string
  dateTo?: string
  adminEmail: string
}

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  diario:       'Diario',
  semanal:      'Semanal (últimos 7 días)',
  mensual:      'Mensual (últimos 30 días)',
  bimestral:    'Bimestral (últimos 2 meses)',
  semestral:    'Semestral (últimos 6 meses)',
  anual:        'Anual (últimos 12 meses)',
  personalizado:'Rango personalizado',
}

export function getPeriodRange(config: ReportConfig): { from: Date; to: Date; label: string } {
  const to = new Date(); to.setHours(23, 59, 59, 999)
  let from = new Date()
  switch (config.period) {
    case 'diario':     from.setHours(0, 0, 0, 0); break
    case 'semanal':    from.setDate(from.getDate() - 7); from.setHours(0,0,0,0); break
    case 'mensual':    from.setDate(1); from.setHours(0,0,0,0); break
    case 'bimestral':  from.setMonth(from.getMonth() - 2); from.setDate(1); from.setHours(0,0,0,0); break
    case 'semestral':  from.setMonth(from.getMonth() - 6); from.setDate(1); from.setHours(0,0,0,0); break
    case 'anual':      from = new Date(from.getFullYear(), 0, 1); from.setHours(0,0,0,0); break
    case 'personalizado':
      from = config.dateFrom ? new Date(config.dateFrom) : new Date(0)
      to.setTime(config.dateTo ? new Date(config.dateTo + 'T23:59:59').getTime() : to.getTime())
      break
  }
  const fmt = (d: Date) => d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  return { from, to, label: `${fmt(from)} — ${fmt(to)}` }
}

function filterByRange(streets: Street[], from: Date, to: Date): Street[] {
  return streets.filter(s => {
    if (!s.created_at) return false
    const d = new Date(s.created_at)
    return d >= from && d <= to
  })
}

// ── Render a Chart.js chart to a base64 PNG ──────────────────────
export async function renderChartToBase64(
  type: 'bar' | 'doughnut' | 'pie',
  labels: string[],
  datasets: { label: string; data: number[]; backgroundColor: string | string[]; borderColor?: string | string[]; borderWidth?: number }[],
  title: string,
  width = 700,
  height = 380,
): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.style.position = 'absolute'
    canvas.style.left = '-9999px'
    document.body.appendChild(canvas)

    // Dynamically import Chart.js to avoid circular issues
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables)
      const chart = new Chart(canvas, {
        type,
        data: { labels, datasets },
        options: {
          animation: false,
          responsive: false,
          plugins: {
            title: { display: true, text: title, color: '#1e3a8a', font: { size: 15, weight: 'bold' } },
            legend: { labels: { color: '#374151', font: { size: 12 }, boxWidth: 14 } },
          },
          scales: type !== 'doughnut' && type !== 'pie' ? {
            x: { ticks: { color: '#374151', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.06)' } },
            y: { ticks: { color: '#374151', stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' } },
          } : undefined,
        },
      })
      // Wait for render
      setTimeout(() => {
        const dataUrl = canvas.toDataURL('image/png')
        chart.destroy()
        document.body.removeChild(canvas)
        resolve(dataUrl)
      }, 150)
    })
  })
}

// ── Excel helpers ────────────────────────────────────────────────
const BLUE  = { argb: 'FF1E3A8A' }
const WHITE = { argb: 'FFFFFFFF' }
const LIGHT = { argb: 'FFF8FAFC' }
const BORDER_THIN: ExcelJS.Border = { style: 'thin', color: { argb: 'FFE2E8F0' } }
const ALL_BORDERS = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN }

const PRIORITY_COLORS: Record<string, string> = {
  MUY_ALTA: 'FFFEE2E2', ALTA: 'FFFFEDD5', MEDIA: 'FFFEF9C3', BAJA: 'FFDCFCE7',
}
const PRIORITY_FONT: Record<string, string> = {
  MUY_ALTA: 'FFB91C1C', ALTA: 'FFC2410C', MEDIA: 'FFA16207', BAJA: 'FF15803D',
}
const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: 'FFF1F5F9', EN_REVISION: 'FFFEF9C3', APROBADO: 'FFDCFCE7', RECHAZADO: 'FFFEE2E2',
}
const STATUS_FONT: Record<string, string> = {
  PENDIENTE: 'FF64748B', EN_REVISION: 'FFA16207', APROBADO: 'FF15803D', RECHAZADO: 'FFB91C1C',
}
const PRIORITY_ES: Record<string, string> = { MUY_ALTA: 'Muy Alta', ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' }
const STATUS_ES: Record<string, string>   = { PENDIENTE: 'Pendiente', EN_REVISION: 'En Revisión', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado' }

function fmtDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function addHeader(ws: ExcelJS.Worksheet, title: string, adminEmail: string, period: string, range: string) {
  ws.mergeCells('A1:K1')
  const t = ws.getCell('A1')
  t.value = `🏛️  AYUNTAMIENTO DE ZIHUATANEJO DE AZUETA — ${title.toUpperCase()}`
  t.font = { bold: true, size: 13, color: WHITE }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: BLUE }
  t.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 32

  ws.mergeCells('A2:K2')
  const sub = ws.getCell('A2')
  sub.value = `Período: ${period}   ·   ${range}   ·   Generado por: ${adminEmail}   ·   ${new Date().toLocaleString('es-MX')}`
  sub.font = { size: 10, color: { argb: 'FF64748B' }, italic: true }
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } }
  sub.alignment = { horizontal: 'center' }
  ws.getRow(2).height = 20
}

function sectionTitle(ws: ExcelJS.Worksheet, row: number, text: string, cols: number) {
  ws.mergeCells(row, 1, row, cols)
  const cell = ws.getCell(row, 1)
  cell.value = text
  cell.font = { bold: true, size: 11, color: WHITE }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }
  cell.alignment = { horizontal: 'left', indent: 1 }
  ws.getRow(row).height = 22
}

// ── Hoja 1: Resumen Ejecutivo ─────────────────────────────────────
function buildResumen(
  wb: ExcelJS.Workbook,
  allStreets: Street[],
  period: Street[],
  config: ReportConfig,
  range: { label: string },
) {
  const ws = wb.addWorksheet('📊 Resumen Ejecutivo', { properties: { tabColor: { argb: 'FF1E3A8A' } } })
  ws.columns = [
    { width: 26 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
  ]

  addHeader(ws, 'Resumen Ejecutivo', config.adminEmail, PERIOD_LABELS[config.period], range.label)

  // KPIs del período
  sectionTitle(ws, 4, '  INDICADORES DEL PERÍODO', 8)

  const kpiHeaders = ['Total Reportes', 'Aprobadas', 'Rechazadas', 'En Revisión', 'Pendientes', 'Prioridad Muy Alta', 'Familias Beneficiadas', 'Score Promedio']
  const approved = period.filter(s => s.status === 'APROBADO')
  const rejected = period.filter(s => s.status === 'RECHAZADO')
  const avgScore = period.length > 0 ? Math.round(period.reduce((a, b) => a + b.impact_score, 0) / period.length) : 0
  const kpiVals  = [
    period.length,
    approved.length,
    rejected.length,
    period.filter(s => s.status === 'EN_REVISION').length,
    period.filter(s => s.status === 'PENDIENTE').length,
    period.filter(s => s.priority === 'MUY_ALTA').length,
    period.reduce((a, b) => a + b.num_viviendas, 0),
    avgScore,
  ]

  const hRow = ws.getRow(5)
  const vRow = ws.getRow(6)
  hRow.height = 28
  vRow.height = 36

  kpiHeaders.forEach((h, i) => {
    const hc = hRow.getCell(i + 1)
    hc.value = h; hc.font = { bold: true, size: 10, color: { argb: 'FF374151' } }
    hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }
    hc.alignment = { horizontal: 'center', wrapText: true }
    hc.border = ALL_BORDERS

    const vc = vRow.getCell(i + 1)
    vc.value = kpiVals[i]
    vc.font = { bold: true, size: 18, color: BLUE }
    vc.alignment = { horizontal: 'center', vertical: 'middle' }
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFF' } }
    vc.border = ALL_BORDERS
  })

  // Distribución por prioridad
  sectionTitle(ws, 8, '  DISTRIBUCIÓN POR PRIORIDAD (PERÍODO)', 8)
  const pHeaders = ws.getRow(9)
  ;['Prioridad', 'Cantidad', '% del Total', 'Gráfico Visual'].forEach((h, i) => {
    const c = pHeaders.getCell(i + 1)
    c.value = h; c.font = { bold: true, size: 10, color: WHITE }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
    c.alignment = { horizontal: 'center' }; c.border = ALL_BORDERS
  })
  ws.getRow(9).height = 20

  const priorities = [
    { label: 'Muy Alta', key: 'MUY_ALTA' },
    { label: 'Alta',     key: 'ALTA'     },
    { label: 'Media',    key: 'MEDIA'    },
    { label: 'Baja',     key: 'BAJA'     },
  ]
  const maxP = Math.max(...priorities.map(p => period.filter(s => s.priority === p.key).length), 1)
  priorities.forEach((p, i) => {
    const count = period.filter(s => s.priority === p.key).length
    const pct   = period.length > 0 ? Math.round(count / period.length * 100) : 0
    const bar   = '█'.repeat(Math.round(count / maxP * 20)) + '░'.repeat(20 - Math.round(count / maxP * 20))
    const row = ws.getRow(10 + i)
    row.height = 20
    ;[p.label, count, `${pct}%`, bar].forEach((v, j) => {
      const c = row.getCell(j + 1)
      c.value = v
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIORITY_COLORS[p.key] } }
      c.font = { bold: j === 0, size: 10, color: { argb: PRIORITY_FONT[p.key] }, family: j === 3 ? 3 : 2 }
      c.alignment = { horizontal: j === 0 ? 'left' : 'center', indent: j === 0 ? 1 : 0 }
      c.border = ALL_BORDERS
    })
  })

  // Totales acumulados
  sectionTitle(ws, 15, '  TOTALES ACUMULADOS (TODO EL SISTEMA)', 8)
  const totHeaders = ws.getRow(16)
  ;['Total Sistema', 'Aprobadas', 'Rechazadas', 'Colonias', 'Familias Totales'].forEach((h, i) => {
    const c = totHeaders.getCell(i + 1)
    c.value = h; c.font = { bold: true, size: 10, color: { argb: 'FF374151' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
    c.alignment = { horizontal: 'center' }; c.border = ALL_BORDERS
  })
  ws.getRow(16).height = 20

  const totRow = ws.getRow(17)
  totRow.height = 28
  ;[
    allStreets.length,
    allStreets.filter(s => s.status === 'APROBADO').length,
    allStreets.filter(s => s.status === 'RECHAZADO').length,
    new Set(allStreets.map(s => s.colonia)).size,
    allStreets.reduce((a, b) => a + b.num_viviendas, 0),
  ].forEach((v, i) => {
    const c = totRow.getCell(i + 1)
    c.value = v; c.font = { bold: true, size: 14, color: BLUE }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: LIGHT }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border = ALL_BORDERS
  })

  ws.getRow(18).height = 6

  // Top colonias
  sectionTitle(ws, 19, '  TOP COLONIAS DEL PERÍODO', 8)
  const cHeaders = ws.getRow(20)
  ;['Colonia', 'Reportes', 'Familias', 'Score Máx.', 'Muy Alta', 'Aprobadas'].forEach((h, i) => {
    const c = cHeaders.getCell(i + 1)
    c.value = h; c.font = { bold: true, size: 10, color: WHITE }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
    c.alignment = { horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 }; c.border = ALL_BORDERS
  })
  ws.getRow(20).height = 20

  const coloniaMap = new Map<string, Street[]>()
  period.forEach(s => { if (!coloniaMap.has(s.colonia)) coloniaMap.set(s.colonia, []); coloniaMap.get(s.colonia)!.push(s) })
  Array.from(coloniaMap.entries()).sort((a, b) => b[1].length - a[1].length).slice(0, 10).forEach(([col, ss], i) => {
    const row = ws.getRow(21 + i); row.height = 18
    ;[col, ss.length, ss.reduce((a, b) => a + b.num_viviendas, 0), Math.max(...ss.map(s => s.impact_score)), ss.filter(s => s.priority === 'MUY_ALTA').length, ss.filter(s => s.status === 'APROBADO').length].forEach((v, j) => {
      const c = row.getCell(j + 1)
      c.value = v
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: i % 2 === 0 ? LIGHT : { argb: 'FFFFFFFF' } }
      c.font = { size: 10, bold: j === 0 }; c.alignment = { horizontal: j === 0 ? 'left' : 'center', indent: j === 0 ? 1 : 0 }; c.border = ALL_BORDERS
    })
  })
}

// ── Hoja de gráficas ─────────────────────────────────────────────
async function buildChartsSheet(
  wb: ExcelJS.Workbook,
  period: Street[],
  config: ReportConfig,
  range: { label: string },
) {
  const ws = wb.addWorksheet('📈 Gráficas', { properties: { tabColor: { argb: 'FF7C3AED' } } })
  ws.columns = Array(12).fill({ width: 13 })

  addHeader(ws, 'Gráficas y Visualizaciones', config.adminEmail, PERIOD_LABELS[config.period], range.label)

  ws.getRow(4).height = 8

  // Render chart 1: Distribución por prioridad (Doughnut)
  const chart1 = await renderChartToBase64(
    'doughnut',
    ['Muy Alta', 'Alta', 'Media', 'Baja'],
    [{
      label: 'Reportes',
      data: [
        period.filter(s => s.priority === 'MUY_ALTA').length,
        period.filter(s => s.priority === 'ALTA').length,
        period.filter(s => s.priority === 'MEDIA').length,
        period.filter(s => s.priority === 'BAJA').length,
      ],
      backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'],
      borderColor: ['#dc2626', '#ea580c', '#ca8a04', '#16a34a'],
      borderWidth: 2,
    }],
    'Distribución por Prioridad',
    600, 380,
  )

  // Render chart 2: Estados (Bar)
  const chart2 = await renderChartToBase64(
    'bar',
    ['Pendiente', 'En Revisión', 'Aprobado', 'Rechazado'],
    [{
      label: 'Calles',
      data: [
        period.filter(s => s.status === 'PENDIENTE').length,
        period.filter(s => s.status === 'EN_REVISION').length,
        period.filter(s => s.status === 'APROBADO').length,
        period.filter(s => s.status === 'RECHAZADO').length,
      ],
      backgroundColor: ['#94a3b8', '#f59e0b', '#22c55e', '#ef4444'],
      borderColor:     ['#64748b', '#d97706', '#16a34a', '#dc2626'],
      borderWidth: 2,
    }],
    'Estado de los Reportes',
    600, 380,
  )

  // Render chart 3: Top 8 colonias (Bar apilado)
  const coloniaMap = new Map<string, Street[]>()
  period.forEach(s => { if (!coloniaMap.has(s.colonia)) coloniaMap.set(s.colonia, []); coloniaMap.get(s.colonia)!.push(s) })
  const topColonias = Array.from(coloniaMap.entries()).sort((a, b) => b[1].length - a[1].length).slice(0, 8)

  const chart3 = await renderChartToBase64(
    'bar',
    topColonias.map(([c]) => c),
    [
      { label: 'Muy Alta', data: topColonias.map(([, ss]) => ss.filter(s => s.priority === 'MUY_ALTA').length), backgroundColor: '#ef4444', borderColor: '#dc2626', borderWidth: 1 },
      { label: 'Alta',     data: topColonias.map(([, ss]) => ss.filter(s => s.priority === 'ALTA').length),     backgroundColor: '#f97316', borderColor: '#ea580c', borderWidth: 1 },
      { label: 'Media',    data: topColonias.map(([, ss]) => ss.filter(s => s.priority === 'MEDIA').length),    backgroundColor: '#eab308', borderColor: '#ca8a04', borderWidth: 1 },
      { label: 'Baja',     data: topColonias.map(([, ss]) => ss.filter(s => s.priority === 'BAJA').length),     backgroundColor: '#22c55e', borderColor: '#16a34a', borderWidth: 1 },
    ],
    'Reportes por Colonia (Top 8)',
    780, 400,
  )

  // Embed charts into the worksheet
  const addImage = (dataUrl: string, row: number, col: number, w: number, h: number) => {
    const b64 = dataUrl.split(',')[1]
    const imgId = wb.addImage({ base64: b64, extension: 'png' })
    ws.addImage(imgId, { tl: { col, row }, ext: { width: w, height: h } })
  }

  // Titles
  const t1 = ws.getCell('A5'); t1.value = '📊 Distribución por Prioridad'; t1.font = { bold: true, size: 11, color: BLUE }; ws.getRow(5).height = 20
  const t2 = ws.getCell('G5'); t2.value = '📋 Estado de los Reportes';     t2.font = { bold: true, size: 11, color: BLUE }
  ws.mergeCells('A37:L37')
  const t3 = ws.getCell('A37'); t3.value = '🏘️ Reportes por Colonia — Top 8 colonias del período'; t3.font = { bold: true, size: 11, color: BLUE }; ws.getRow(37).height = 20

  addImage(chart1, 5, 0,  560, 360)  // row 5, col A
  addImage(chart2, 5, 6,  560, 360)  // row 5, col G
  addImage(chart3, 37, 0, 780, 400)  // row 37 full width
}

// ── Hoja de lista estilizada ──────────────────────────────────────
function buildListSheet(wb: ExcelJS.Workbook, streets: Street[], sheetName: string, title: string, config: ReportConfig, range: { label: string }) {
  const ws = wb.addWorksheet(sheetName)
  ws.columns = [
    { width: 5 }, { width: 28 }, { width: 20 }, { width: 12 },
    { width: 8 }, { width: 10 }, { width: 12 }, { width: 10 },
    { width: 12 }, { width: 18 }, { width: 20 },
  ]

  addHeader(ws, title, config.adminEmail, PERIOD_LABELS[config.period], range.label)
  ws.getRow(3).height = 8

  const headers = ['#', 'Calle / Andador', 'Colonia', 'Prioridad', 'Score', 'Viviendas', 'Tipo Vía', 'Tráfico', 'Estado', 'Fecha', 'Reportante']
  const hRow = ws.getRow(4); hRow.height = 22
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1)
    c.value = h; c.font = { bold: true, size: 10, color: WHITE }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: BLUE }
    c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = ALL_BORDERS
  })

  streets.forEach((s, i) => {
    const row = ws.getRow(5 + i); row.height = 18
    const baseFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: i % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' } }
    ;[i + 1, s.street_name, s.colonia, PRIORITY_ES[s.priority] ?? s.priority, s.impact_score, s.num_viviendas, s.via_type, s.traffic_type, STATUS_ES[s.status] ?? s.status, fmtDate(s.created_at), s.reporter_name ?? '—'].forEach((v, j) => {
      const c = row.getCell(j + 1)
      c.value = v; c.border = ALL_BORDERS
      if (j === 3) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIORITY_COLORS[s.priority] } }
        c.font = { bold: true, size: 10, color: { argb: PRIORITY_FONT[s.priority] } }
        c.alignment = { horizontal: 'center' }
      } else if (j === 8) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_COLORS[s.status] } }
        c.font = { bold: true, size: 10, color: { argb: STATUS_FONT[s.status] } }
        c.alignment = { horizontal: 'center' }
      } else if (j === 4) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIORITY_COLORS[s.priority] } }
        c.font = { bold: true, size: 11, color: { argb: PRIORITY_FONT[s.priority] } }
        c.alignment = { horizontal: 'center' }
      } else {
        c.fill = baseFill; c.font = { size: 10 }; c.alignment = { horizontal: j === 1 || j === 2 ? 'left' : 'center', indent: j <= 2 ? 1 : 0 }
      }
    })
  })

  if (streets.length === 0) {
    const r = ws.getRow(5)
    ws.mergeCells('A5:K5')
    r.getCell(1).value = 'Sin registros en este período'
    r.getCell(1).font = { italic: true, color: { argb: 'FF94A3B8' } }
    r.getCell(1).alignment = { horizontal: 'center' }
    r.height = 24
  }
}

// ── Hoja por colonia ──────────────────────────────────────────────
function buildColoniaSheet(wb: ExcelJS.Workbook, streets: Street[], config: ReportConfig, range: { label: string }) {
  const ws = wb.addWorksheet('🏘️ Por Colonia')
  ws.columns = [{ width: 24 }, { width: 12 }, { width: 12 }, { width: 13 }, { width: 13 }, { width: 12 }, { width: 10 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 12 }, { width: 14 }]

  addHeader(ws, 'Análisis por Colonia', config.adminEmail, PERIOD_LABELS[config.period], range.label)
  ws.getRow(3).height = 8

  const headers = ['Colonia', 'Total', 'Aprobadas', 'Rechazadas', 'En Revisión', 'Pendientes', 'Muy Alta', 'Alta', 'Media', 'Baja', 'Familias', 'Score Prom.']
  const hRow = ws.getRow(4); hRow.height = 22
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1)
    c.value = h; c.font = { bold: true, size: 10, color: WHITE }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: BLUE }
    c.alignment = { horizontal: 'center' }; c.border = ALL_BORDERS
  })

  const coloniaMap = new Map<string, Street[]>()
  streets.forEach(s => { if (!coloniaMap.has(s.colonia)) coloniaMap.set(s.colonia, []); coloniaMap.get(s.colonia)!.push(s) })

  Array.from(coloniaMap.entries()).sort((a, b) => b[1].length - a[1].length).forEach(([col, ss], i) => {
    const row = ws.getRow(5 + i); row.height = 18
    ;[col, ss.length, ss.filter(s => s.status === 'APROBADO').length, ss.filter(s => s.status === 'RECHAZADO').length, ss.filter(s => s.status === 'EN_REVISION').length, ss.filter(s => s.status === 'PENDIENTE').length, ss.filter(s => s.priority === 'MUY_ALTA').length, ss.filter(s => s.priority === 'ALTA').length, ss.filter(s => s.priority === 'MEDIA').length, ss.filter(s => s.priority === 'BAJA').length, ss.reduce((a, b) => a + b.num_viviendas, 0), Math.round(ss.reduce((a, b) => a + b.impact_score, 0) / ss.length)].forEach((v, j) => {
      const c = row.getCell(j + 1)
      c.value = v
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: i % 2 === 0 ? LIGHT : { argb: 'FFFFFFFF' } }
      c.font = { size: 10, bold: j === 0 }; c.alignment = { horizontal: j === 0 ? 'left' : 'center', indent: j === 0 ? 1 : 0 }; c.border = ALL_BORDERS
    })
  })
}

// ── Función principal ────────────────────────────────────────────
export async function generatePeriodicReport(allStreets: Street[], config: ReportConfig): Promise<void> {
  const range  = getPeriodRange(config)
  const period = filterByRange(allStreets, range.from, range.to)

  const wb = new ExcelJS.Workbook()
  wb.creator    = config.adminEmail
  wb.company    = 'Ayuntamiento de Zihuatanejo de Azueta'
  wb.created    = new Date()
  wb.description = `Reporte ${PERIOD_LABELS[config.period]} — PriorizaZihua`

  // Hoja 1: Resumen
  buildResumen(wb, allStreets, period, config, range)

  // Hoja 2: Gráficas (async — renderiza Chart.js)
  await buildChartsSheet(wb, period, config, range)

  // Hojas de listas
  buildListSheet(wb, period,                                         '📋 Todos',       'Todos los Reportes del Período', config, range)
  buildListSheet(wb, period.filter(s => s.status === 'APROBADO'),   '✅ Aprobadas',   'Calles Aprobadas',               config, range)
  buildListSheet(wb, period.filter(s => s.status === 'EN_REVISION'),'🔍 En Revisión', 'Calles en Revisión',             config, range)
  buildListSheet(wb, period.filter(s => s.status === 'PENDIENTE'),  '⏳ Pendientes',  'Calles Pendientes',              config, range)
  buildListSheet(wb, period.filter(s => s.status === 'RECHAZADO'),  '❌ Rechazadas',  'Calles Rechazadas',              config, range)
  buildColoniaSheet(wb, period, config, range)

  // Descargar
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  const dateStr = new Date().toISOString().slice(0, 10)
  const periodKey = PERIOD_LABELS[config.period].split(' ')[0].toLowerCase()
  a.href = url
  a.download = `PriorizaZihua_Reporte_${periodKey}_${dateStr}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
