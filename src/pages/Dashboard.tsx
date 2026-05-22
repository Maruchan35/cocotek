import { useEffect, useState, useMemo } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { notifyCitizen } from '../lib/emailService'
import { signOut } from '../lib/auth'
import { exportToExcel } from '../lib/excelExport'
import { generatePeriodicReport } from '../lib/reportGenerator'
import type { ReportPeriod } from '../lib/reportGenerator'
import { fetchAllProfiles, upsertProfile, deleteProfile } from '../lib/userProfiles'
import type { UserProfile } from '../types'
import { DashboardMap } from '../components/MapView'
import { priorityLabels, priorityColors, DEFAULT_WEIGHTS, maxScore } from '../lib/priorityEngine'
import { fetchWeights, saveWeights, WEIGHT_LABELS, WEIGHT_GROUPS } from '../lib/weightsConfig'
import type { Street, Status, ColoniaStats, PriorityWeights, StatusHistoryEntry } from '../types'
import {
  LayoutDashboard, Map, TableProperties, BarChart3, FileDown,
  LogOut, CheckCircle, Clock, XCircle, Users, AlertTriangle,
  Building2, RefreshCw, ChevronDown, ChevronUp, Eye, Settings,
  Save, RotateCcw, Search, X, ChevronLeft, ChevronRight,
  Columns, FileText, CalendarDays, ClipboardList, UserCog,
} from 'lucide-react'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale,
  LinearScale, BarElement, BarController, Title, LineElement, PointElement, Filler,
} from 'chart.js'
import { Doughnut, Bar, Line } from 'react-chartjs-2'

ChartJS.register(
  ArcElement, Tooltip, Legend, CategoryScale,
  LinearScale, BarElement, BarController, Title, LineElement, PointElement, Filler,
)

type Tab = 'overview' | 'map' | 'table' | 'kanban' | 'reports' | 'config' | 'usuarios'

const statusConfig = {
  PENDIENTE:   { label: 'Pendiente',   badge: 'badge-pendiente' },
  EN_REVISION: { label: 'En Revisión', badge: 'badge-revision'  },
  APROBADO:    { label: 'Aprobado',    badge: 'badge-aprobado'  },
  RECHAZADO:   { label: 'Rechazado',   badge: 'badge-rechazado' },
}

export default function Dashboard({ session }: { session: Session }) {
  const [streets, setStreets]                   = useState<Street[]>([])
  const [loading, setLoading]                   = useState(true)
  const [tab, setTab]                           = useState<Tab>('overview')
  const [filterColonia, setFilterColonia]       = useState('')
  const [filterStatus, setFilterStatus]         = useState('')
  const [filterPriority, setFilterPriority]     = useState('')
  const [selectedStreet, setSelectedStreet]     = useState<Street | null>(null)
  const [updating, setUpdating]                 = useState<string | null>(null)
  const [weights, setWeights]                   = useState<PriorityWeights>(DEFAULT_WEIGHTS)
  const [selectedIds, setSelectedIds]           = useState<Set<string>>(new Set())
  const [showReportModal, setShowReportModal]   = useState(false)
  const [reportPeriod, setReportPeriod]         = useState<ReportPeriod>('mensual')
  const [reportDateFrom, setReportDateFrom]     = useState('')
  const [reportDateTo, setReportDateTo]         = useState('')
  const [generatingReport, setGeneratingReport] = useState(false)

  const fetchStreets = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('streets')
      .select('*')
      .order('impact_score', { ascending: false })
    if (!error && data) setStreets(data as Street[])
    setLoading(false)
  }

  useEffect(() => {
    fetchStreets()
    fetchWeights().then(setWeights)
  }, [])

  const colonias = useMemo(() => [...new Set(streets.map(s => s.colonia))].sort(), [streets])

  const filtered = useMemo(() => streets.filter(s => {
    if (filterColonia  && s.colonia  !== filterColonia)  return false
    if (filterStatus   && s.status   !== filterStatus)   return false
    if (filterPriority && s.priority !== filterPriority) return false
    return true
  }), [streets, filterColonia, filterStatus, filterPriority])

  const stats = useMemo(() => ({
    total:     streets.length,
    muy_alta:  streets.filter(s => s.priority === 'MUY_ALTA').length,
    familias:  streets.reduce((a, b) => a + b.num_viviendas, 0),
    colonias:  new Set(streets.map(s => s.colonia)).size,
    aprobadas: streets.filter(s => s.status === 'APROBADO').length,
  }), [streets])

  const coloniaStats: ColoniaStats[] = useMemo(() =>
    colonias.map(col => {
      const items = streets.filter(s => s.colonia === col)
      return {
        colonia:         col,
        total_calles:    items.length,
        total_viviendas: items.reduce((a, b) => a + b.num_viviendas, 0),
        muy_alta:        items.filter(s => s.priority === 'MUY_ALTA').length,
        alta:            items.filter(s => s.priority === 'ALTA').length,
        media:           items.filter(s => s.priority === 'MEDIA').length,
        baja:            items.filter(s => s.priority === 'BAJA').length,
        avg_score: items.length > 0
          ? Math.round(items.reduce((a, b) => a + b.impact_score, 0) / items.length)
          : 0,
      }
    }).sort((a, b) => b.avg_score - a.avg_score)
  , [streets, colonias])

  const updateStatus = async (id: string, status: Status, notes = '') => {
    setUpdating(id)
    const street = streets.find(s => s.id === id)
    await supabase.from('streets').update({ status, admin_notes: notes || street?.admin_notes || '' }).eq('id', id)
    // Intentar guardar historial — no rompe si la tabla no existe
    try {
      await supabase.from('status_history').insert({
        street_id:  id,
        old_status: street?.status ?? null,
        new_status: status,
        changed_by: session.user.email ?? 'admin',
        notes,
      })
    } catch (_) { /* tabla opcional */ }
    // Notificar al ciudadano si tiene correo registrado y el estado es visible para él
    if (street?.reporter_email && (status === 'EN_REVISION' || status === 'APROBADO' || status === 'RECHAZADO')) {
      notifyCitizen({
        to: street.reporter_email,
        reporterName: street.reporter_name,
        streetName: street.street_name,
        colonia: street.colonia,
        type: status,
        adminNotes: notes || street.admin_notes || '',
      })
    }
    setStreets(prev => prev.map(s => s.id === id ? { ...s, status, admin_notes: notes || s.admin_notes } : s))
    if (selectedStreet?.id === id)
      setSelectedStreet(prev => prev ? { ...prev, status, admin_notes: notes || prev.admin_notes } : null)
    setUpdating(null)
  }

  const bulkUpdateStatus = async (status: Status) => {
    for (const id of Array.from(selectedIds)) {
      await updateStatus(id, status)
    }
    setSelectedIds(new Set())
  }

  const exportToPDF = () => {
    const pColors: Record<string, string> = { MUY_ALTA: '#ef4444', ALTA: '#f97316', MEDIA: '#eab308', BAJA: '#22c55e' }
    const pLabels: Record<string, string> = { MUY_ALTA: 'Muy Alta', ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' }
    const sLabels: Record<string, string> = { PENDIENTE: 'Pendiente', EN_REVISION: 'En Revisión', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado' }
    const date = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
    const rows = streets.map((s, i) => `
      <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">
        <td style="padding:7px 10px;font-weight:700;color:#64748b">${i + 1}</td>
        <td style="padding:7px 10px;font-weight:600">${s.street_name}</td>
        <td style="padding:7px 10px">${s.colonia}</td>
        <td style="padding:7px 10px">
          <span style="background:${pColors[s.priority]}22;color:${pColors[s.priority]};border:1px solid ${pColors[s.priority]}55;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700">${pLabels[s.priority]}</span>
        </td>
        <td style="padding:7px 10px;font-weight:800;color:${pColors[s.priority]}">${s.impact_score}/120</td>
        <td style="padding:7px 10px">${s.num_viviendas} fam.</td>
        <td style="padding:7px 10px">${sLabels[s.status] ?? s.status}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>PriorizaZihua — Reporte</title>
    <style>body{font-family:Arial,sans-serif;margin:0;padding:28px;color:#1e293b}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #1e40af}
    .hdr h1{margin:0;font-size:20px;color:#1e40af}.hdr p{margin:4px 0 0;font-size:11px;color:#64748b}
    .meta{text-align:right;font-size:11px;color:#64748b}.meta b{font-size:13px;display:block;margin-bottom:4px}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
    .kpi{border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center}
    .kv{font-size:26px;font-weight:900;color:#1e40af}.kl{font-size:10px;color:#64748b;margin-top:3px}
    h2{font-size:14px;margin:0 0 10px}table{width:100%;border-collapse:collapse;font-size:12px}
    thead tr{background:#1e40af;color:#fff}thead th{padding:9px 10px;text-align:left;font-weight:700}
    .foot{margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
    @media print{body{padding:12px}}</style></head><body>
    <div class="hdr">
      <div><h1>🏛️ Ayuntamiento de Zihuatanejo de Azueta</h1><p>Sistema PriorizaZihua — Reporte Oficial de Pavimentación</p></div>
      <div class="meta"><b>REPORTE DE PRIORIZACIÓN</b>${date}<br>${session.user.email}</div>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="kv">${streets.length}</div><div class="kl">Total reportes</div></div>
      <div class="kpi"><div class="kv" style="color:#ef4444">${streets.filter(s => s.priority === 'MUY_ALTA').length}</div><div class="kl">Prioridad Muy Alta</div></div>
      <div class="kpi"><div class="kv" style="color:#22c55e">${streets.filter(s => s.status === 'APROBADO').length}</div><div class="kl">Aprobadas</div></div>
      <div class="kpi"><div class="kv">${streets.reduce((a, b) => a + b.num_viviendas, 0).toLocaleString()}</div><div class="kl">Familias beneficiadas</div></div>
    </div>
    <h2>Listado por Prioridad Automática</h2>
    <table><thead><tr><th>#</th><th>Calle / Andador</th><th>Colonia</th><th>Prioridad</th><th>Score</th><th>Familias</th><th>Estado</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="foot">PriorizaZihua · Ayuntamiento de Zihuatanejo de Azueta · ${date}</div>
    </body></html>`
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 600) }
  }

  const sidebarItems: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Resumen',              icon: <LayoutDashboard size={16} /> },
    { key: 'map',      label: 'Mapa',                 icon: <Map size={16} /> },
    { key: 'table',    label: 'Tabla de Prioridades', icon: <TableProperties size={16} /> },
    { key: 'kanban',   label: 'Kanban',               icon: <Columns size={16} /> },
    { key: 'reports',  label: 'Reportes por Colonia', icon: <BarChart3 size={16} /> },
    { key: 'config',   label: 'Configuración',        icon: <Settings size={16} /> },
    { key: 'usuarios', label: 'Presidentes',          icon: <UserCog size={16} /> },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">🏛️</div>
          <div>
            <div className="navbar-title">PriorizaZihua</div>
            <div className="navbar-subtitle">Panel de Administración</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-primary btn-sm" onClick={() => setShowReportModal(true)}
            style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)', fontWeight: 700 }}>
            <ClipboardList size={14} /> Generar Reporte
          </button>
          <button className="btn btn-excel btn-sm" onClick={() => exportToExcel(streets)}>
            <FileDown size={14} /> Excel
          </button>
          <button className="btn btn-ghost btn-sm" onClick={exportToPDF}
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
            <FileText size={14} /> PDF
          </button>
          <button className="btn btn-ghost btn-sm" onClick={fetchStreets}>
            <RefreshCw size={14} />
          </button>
          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{session.user.email}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => signOut()}>
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* ── Modal Generar Reporte ── */}
      {showReportModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20,
        }} onClick={() => setShowReportModal(false)}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', padding: 32,
            width: '100%', maxWidth: 520, border: '1px solid var(--surface-border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            {/* Cabecera */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ClipboardList size={22} color="#fff" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Generar Reporte Periódico</h2>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--gray-400)' }}>Exporta un reporte Excel con múltiples hojas</p>
              </div>
              <button onClick={() => setShowReportModal(false)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Selector de período */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-300)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Período del reporte
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {([
                  { key: 'diario',    label: '📅 Diario',    desc: 'Hoy' },
                  { key: 'semanal',   label: '📆 Semanal',   desc: 'Últimos 7 días' },
                  { key: 'mensual',   label: '🗓️ Mensual',   desc: 'Este mes' },
                  { key: 'bimestral', label: '📊 Bimestral', desc: 'Últimos 2 meses' },
                  { key: 'semestral', label: '📈 Semestral', desc: 'Últimos 6 meses' },
                  { key: 'anual',     label: '🏆 Anual',     desc: 'Este año' },
                ] as const).map(opt => (
                  <button key={opt.key} onClick={() => setReportPeriod(opt.key as ReportPeriod)}
                    style={{
                      padding: '10px 8px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      border: reportPeriod === opt.key ? '2px solid var(--brand-400)' : '1.5px solid var(--surface-border)',
                      background: reportPeriod === opt.key ? 'rgba(59,130,246,0.12)' : 'var(--surface-card2)',
                      transition: 'all 0.15s', textAlign: 'center',
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: reportPeriod === opt.key ? 'var(--brand-300)' : 'var(--gray-200)' }}>{opt.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--gray-500)', marginTop: 2 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Personalizado */}
            <div style={{ marginBottom: 20 }}>
              <button onClick={() => setReportPeriod('personalizado')}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  border: reportPeriod === 'personalizado' ? '2px solid var(--brand-400)' : '1.5px solid var(--surface-border)',
                  background: reportPeriod === 'personalizado' ? 'rgba(59,130,246,0.12)' : 'var(--surface-card2)',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                }}>
                <CalendarDays size={15} color={reportPeriod === 'personalizado' ? 'var(--brand-400)' : 'var(--gray-400)'} />
                <span style={{ fontWeight: 700, fontSize: 13, color: reportPeriod === 'personalizado' ? 'var(--brand-300)' : 'var(--gray-300)' }}>📋 Rango personalizado</span>
              </button>
              {reportPeriod === 'personalizado' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
                  <input type="date" className="form-input" style={{ flex: 1, fontSize: 13 }}
                    value={reportDateFrom} onChange={e => setReportDateFrom(e.target.value)} />
                  <span style={{ color: 'var(--gray-500)' }}>—</span>
                  <input type="date" className="form-input" style={{ flex: 1, fontSize: 13 }}
                    value={reportDateTo} onChange={e => setReportDateTo(e.target.value)} />
                </div>
              )}
            </div>

            {/* Preview del contenido */}
            <div style={{
              background: 'var(--surface-card2)', borderRadius: 'var(--radius-md)',
              padding: '14px 16px', marginBottom: 20,
              border: '1px solid var(--surface-border)',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>El reporte incluirá 7 hojas Excel:</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {[
                  '📊 Resumen Ejecutivo',
                  '📈 Gráficas (3 gráficas)',
                  '📋 Todos los Reportes',
                  '✅ Calles Aprobadas',
                  '🔍 En Revisión',
                  '⏳ Pendientes',
                  '❌ Rechazadas',
                  '🏘️ Análisis por Colonia',
                ].map(s => (
                  <div key={s} style={{ fontSize: 12, color: 'var(--gray-300)', padding: '3px 0' }}>{s}</div>
                ))}
              </div>
            </div>

            {/* Botón generar */}
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: 14, fontWeight: 700 }}
              disabled={generatingReport || (reportPeriod === 'personalizado' && !reportDateFrom)}
              onClick={async () => {
                setGeneratingReport(true)
                try {
                  await generatePeriodicReport(streets, {
                    period: reportPeriod,
                    dateFrom: reportDateFrom || undefined,
                    dateTo: reportDateTo || undefined,
                    adminEmail: session.user.email ?? 'admin',
                  })
                } catch (e) {
                  console.error('Error generando reporte:', e)
                } finally {
                  setGeneratingReport(false)
                  setShowReportModal(false)
                }
              }}
            >
              {generatingReport ? '⏳ Generando gráficas...' : '⬇️ Descargar Reporte Excel (con gráficas)'}
            </button>
          </div>
        </div>
      )}

      <div className="dashboard-layout">
        <nav className="sidebar">
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-600)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 16px', marginBottom: 4 }}>
            Navegación
          </p>
          {sidebarItems.map(item => {
            const pendingCount = item.key === 'table' ? streets.filter(s => s.status === 'PENDIENTE').length : 0
            return (
              <button key={item.key} className={`sidebar-item ${tab === item.key ? 'active' : ''}`}
                onClick={() => setTab(item.key)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  {item.icon} {item.label}
                  {pendingCount > 0 && (
                    <span style={{
                      marginLeft: 'auto', background: '#ef4444', color: '#fff',
                      borderRadius: '999px', fontSize: 10, fontWeight: 800,
                      padding: '1px 7px', minWidth: 18, textAlign: 'center',
                    }}>{pendingCount}</span>
                  )}
                </span>
              </button>
            )
          })}
          <div className="divider" style={{ margin: '12px 0' }} />
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-600)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 16px', marginBottom: 8 }}>
            Leyenda
          </p>
          {(['MUY_ALTA', 'ALTA', 'MEDIA', 'BAJA'] as const).map(p => (
            <div key={p} className="flex items-center gap-2" style={{ padding: '4px 16px', fontSize: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: priorityColors[p] }} />
              <span style={{ color: 'var(--gray-400)' }}>{priorityLabels[p]}</span>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <a href="/report" target="_blank" style={{ fontSize: 12, color: 'var(--brand-400)', padding: '8px 16px', display: 'block' }}>
            ↗ Formulario ciudadano
          </a>
        </nav>

        <main className="main-content">
          {loading ? (
            <div className="flex items-center justify-center" style={{ height: 300 }}>
              <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
                <p className="text-muted">Cargando datos...</p>
              </div>
            </div>
          ) : (
            <>
              {tab === 'overview' && <OverviewTab stats={stats} streets={streets} />}
              {tab === 'map'      && <MapTab streets={filtered} onSelect={setSelectedStreet} colonias={colonias} filterColonia={filterColonia} setFilterColonia={setFilterColonia} filterPriority={filterPriority} setFilterPriority={setFilterPriority} />}
              {tab === 'table'    && <TableTab streets={filtered} colonias={colonias} filterColonia={filterColonia} setFilterColonia={setFilterColonia} filterStatus={filterStatus} setFilterStatus={setFilterStatus} filterPriority={filterPriority} setFilterPriority={setFilterPriority} onUpdateStatus={updateStatus} updating={updating} onSelectStreet={setSelectedStreet} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onBulkUpdate={bulkUpdateStatus} />}
              {tab === 'kanban'   && <KanbanTab streets={filtered} onUpdateStatus={updateStatus} updating={updating} onSelectStreet={setSelectedStreet} />}
              {tab === 'reports'  && <ReportsTab coloniaStats={coloniaStats} streets={streets} />}
              {tab === 'config'   && <ConfigTab weights={weights} setWeights={setWeights} userEmail={session.user.email ?? 'admin'} />}
              {tab === 'usuarios' && <UsersTab colonias={colonias} />}
            </>
          )}
        </main>
      </div>

      {selectedStreet && (
        <StreetModal
          street={selectedStreet}
          onClose={() => setSelectedStreet(null)}
          onUpdateStatus={updateStatus}
          updating={updating}
          userEmail={session.user.email ?? 'admin'}
        />
      )}
    </div>
  )
}

/* ── OVERVIEW TAB ───────────────────────────────────────────────── */
function OverviewTab({ stats, streets }: { stats: any; streets: Street[] }) {
  const doughnutData = {
    labels: ['Muy Alta', 'Alta', 'Media', 'Baja'],
    datasets: [{
      data: [
        streets.filter(s => s.priority === 'MUY_ALTA').length,
        streets.filter(s => s.priority === 'ALTA').length,
        streets.filter(s => s.priority === 'MEDIA').length,
        streets.filter(s => s.priority === 'BAJA').length,
      ],
      backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'],
      borderColor: 'transparent',
      borderWidth: 0,
    }],
  }

  const kpis = [
    { label: 'Total Reportes',        value: stats.total,                    icon: <Building2 size={20} />,     color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    { label: 'Prioridad Muy Alta',    value: stats.muy_alta,                 icon: <AlertTriangle size={20} />, color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    { label: 'Familias Beneficiadas', value: stats.familias.toLocaleString(),icon: <Users size={20} />,         color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
    { label: 'Colonias Registradas',  value: stats.colonias,                 icon: <Map size={20} />,           color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  ]

  return (
    <>
      <div>
        <h2 className="text-xl font-bold mb-4">Resumen General</h2>
        <div className="kpi-grid">
          {kpis.map((k, i) => (
            <div key={i} className="kpi-card animate-fade-in-up"
              style={{ '--kpi-color': k.color, '--kpi-bg': k.bg, animationDelay: `${i * 0.08}s` } as any}>
              <div className="kpi-icon">{k.icon}</div>
              <div className="kpi-value">{k.value}</div>
              <div className="kpi-label">{k.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3 className="font-semi mb-4" style={{ fontSize: 15 }}>Distribución de Prioridades</h3>
          <div style={{ maxWidth: 260, margin: '0 auto' }}>
            <Doughnut data={doughnutData} options={{
              plugins: { legend: { labels: { color: '#94a3b8', font: { size: 12 } } } },
              cutout: '65%',
            }} />
          </div>
        </div>
        <div className="card">
          <h3 className="font-semi mb-4" style={{ fontSize: 15 }}>Top 5 Calles Críticas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {streets.slice(0, 5).map((s, i) => (
              <div key={s.id} className="flex items-center gap-3"
                style={{ padding: '8px 12px', background: 'var(--surface-card2)', borderRadius: 8 }}>
                <span style={{ fontWeight: 800, color: 'var(--gray-500)', fontSize: 13, width: 20 }}>#{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.street_name}</p>
                  <p style={{ fontSize: 11, color: 'var(--gray-400)' }}>{s.colonia}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 18, color: priorityColors[s.priority] }}>{s.impact_score}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray-500)' }}>pts</div>
                </div>
              </div>
            ))}
            {streets.length === 0 && <p className="text-muted text-center" style={{ padding: 20 }}>Sin datos aún</p>}
          </div>
        </div>
      </div>
    </>
  )
}

/* ── MAP TAB ────────────────────────────────────────────────────── */
function MapTab({ streets, onSelect, colonias, filterColonia, setFilterColonia, filterPriority, setFilterPriority }: any) {
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold">Mapa de Calles</h2>
        <div className="flex gap-3">
          <select className="form-select" style={{ width: 'auto' }} value={filterColonia} onChange={e => setFilterColonia(e.target.value)}>
            <option value="">Todas las colonias</option>
            {colonias.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-select" style={{ width: 'auto' }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="">Todas las prioridades</option>
            <option value="MUY_ALTA">🔴 Muy Alta</option>
            <option value="ALTA">🟠 Alta</option>
            <option value="MEDIA">🟡 Media</option>
            <option value="BAJA">🟢 Baja</option>
          </select>
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <DashboardMap streets={streets} onSelectStreet={onSelect} />
      </div>
      <p className="text-sm text-muted text-center">
        {streets.length} calles en el mapa · Haz clic en un pin para ver detalles
      </p>
    </>
  )
}

/* ── TABLE TAB ──────────────────────────────────────────────────── */
const PAGE_SIZE = 15

function TableTab({ streets, colonias, filterColonia, setFilterColonia, filterStatus, setFilterStatus, filterPriority, setFilterPriority, onUpdateStatus, updating, onSelectStreet, selectedIds, setSelectedIds, onBulkUpdate }: any) {
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage]               = useState(1)
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')

  // Aplicar búsqueda de texto + fechas
  const searched = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return (streets as Street[]).filter(s => {
      if (q && !s.street_name.toLowerCase().includes(q) && !s.colonia.toLowerCase().includes(q) && !(s.reporter_name ?? '').toLowerCase().includes(q)) return false
      if (dateFrom && s.created_at && new Date(s.created_at) < new Date(dateFrom)) return false
      if (dateTo && s.created_at && new Date(s.created_at) > new Date(dateTo + 'T23:59:59')) return false
      return true
    })
  }, [streets, searchQuery, dateFrom, dateTo])

  const resetPage = () => setPage(1)
  const totalPages = Math.max(1, Math.ceil(searched.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = searched.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSearch = (val: string) => { setSearchQuery(val); resetPage() }
  const handleFilter = (setter: Function) => (e: React.ChangeEvent<HTMLSelectElement>) => { setter(e.target.value); resetPage() }

  const allPageSelected = paginated.length > 0 && paginated.every((s: Street) => selectedIds.has(s.id))
  const toggleAll = (checked: boolean) => {
    const next = new Set(selectedIds)
    paginated.forEach((s: Street) => checked ? next.add(s.id) : next.delete(s.id))
    setSelectedIds(next)
  }

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold">Tabla de Priorización</h2>
      </div>

      {/* ── Barra de búsqueda + filtros ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-500)', pointerEvents: 'none' }} />
          <input className="form-input" style={{ paddingLeft: 36, paddingRight: searchQuery ? 36 : 12, fontSize: 13 }}
            placeholder="Buscar calle, colonia…" value={searchQuery} onChange={e => handleSearch(e.target.value)} />
          {searchQuery && (
            <button onClick={() => handleSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', padding: 2 }}>
              <X size={14} />
            </button>
          )}
        </div>
        <select className="form-select" style={{ width: 'auto', fontSize: 13 }} value={filterColonia} onChange={handleFilter(setFilterColonia)}>
          <option value="">Todas las colonias</option>
          {colonias.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto', fontSize: 13 }} value={filterPriority} onChange={handleFilter(setFilterPriority)}>
          <option value="">Todas las prioridades</option>
          <option value="MUY_ALTA">🔴 Muy Alta</option>
          <option value="ALTA">🟠 Alta</option>
          <option value="MEDIA">🟡 Media</option>
          <option value="BAJA">🟢 Baja</option>
        </select>
        <select className="form-select" style={{ width: 'auto', fontSize: 13 }} value={filterStatus} onChange={handleFilter(setFilterStatus)}>
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="EN_REVISION">En Revisión</option>
          <option value="APROBADO">Aprobado</option>
          <option value="RECHAZADO">Rechazado</option>
        </select>
        {/* Filtro por fecha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CalendarDays size={13} color="var(--gray-500)" />
          <input type="date" className="form-input" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
            value={dateFrom} onChange={e => { setDateFrom(e.target.value); resetPage() }} />
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>—</span>
          <input type="date" className="form-input" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
            value={dateTo} onChange={e => { setDateTo(e.target.value); resetPage() }} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); resetPage() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Barra de acciones en lote ── */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(99,102,241,0.08))',
          border: '1.5px solid rgba(59,130,246,0.35)', borderRadius: 'var(--radius-md)',
        }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--brand-300)' }}>
            ✓ {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-success btn-sm" onClick={() => onBulkUpdate('APROBADO')}>
              <CheckCircle size={12} /> Aprobar todas
            </button>
            <button className="btn btn-warning btn-sm" onClick={() => onBulkUpdate('EN_REVISION')}>
              <Clock size={12} /> En Revisión
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => onBulkUpdate('RECHAZADO')}>
              <XCircle size={12} /> Rechazar
            </button>
          </div>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 16 }}
            onClick={() => setSelectedIds(new Set())}>✕</button>
        </div>
      )}

      {/* Tabla */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: 36, textAlign: 'center' }}>
                <input type="checkbox" checked={allPageSelected}
                  onChange={e => toggleAll(e.target.checked)}
                  style={{ cursor: 'pointer' }} />
              </th>
              <th>#</th>
              <th>Calle / Andador</th>
              <th>Colonia</th>
              <th>Prioridad</th>
              <th>Score</th>
              <th>Viviendas</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-500)' }}>
                {searchQuery
                  ? `No se encontraron calles que coincidan con "${searchQuery}"`
                  : 'No hay registros con los filtros seleccionados'}
              </td></tr>
            )}
            {paginated.map((s: Street, i: number) => (
              <tr key={s.id} style={{ cursor: 'pointer', background: selectedIds.has(s.id) ? 'rgba(59,130,246,0.07)' : undefined }} onClick={() => onSelectStreet(s)}>
                <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={selectedIds.has(s.id)}
                    style={{ cursor: 'pointer' }}
                    onChange={e => {
                      const next = new Set(selectedIds)
                      e.target.checked ? next.add(s.id) : next.delete(s.id)
                      setSelectedIds(next)
                    }} />
                </td>
                <td style={{ color: 'var(--gray-500)', fontWeight: 600 }}>
                  {(safePage - 1) * PAGE_SIZE + i + 1}
                </td>
                <td>
                  <p style={{ fontWeight: 600, fontSize: 13 }}>{s.street_name}</p>
                  <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>{s.length_m}m · {s.via_type}</p>
                </td>
                <td style={{ fontSize: 13 }}>{s.colonia}</td>
                <td>
                  <span className={`badge badge-${s.priority.toLowerCase().replace('_', '-')}`}>
                    ● {priorityLabels[s.priority]}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 800, fontSize: 16, color: priorityColors[s.priority] }}>{s.impact_score}</span>
                  <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>/120</span>
                </td>
                <td style={{ fontSize: 13 }}>🏠 {s.num_viviendas}</td>
                <td>
                  <span className={`badge badge-${s.status.toLowerCase().replace('_', '-')}`}>
                    {statusConfig[s.status]?.label ?? s.status}
                  </span>
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="flex gap-2">
                    {s.status !== 'APROBADO' && (
                      <button className="btn btn-success btn-sm" disabled={updating === s.id}
                        onClick={() => onUpdateStatus(s.id, 'APROBADO')}>
                        <CheckCircle size={12} /> Aprobar
                      </button>
                    )}
                    {s.status !== 'EN_REVISION' && (
                      <button className="btn btn-warning btn-sm" disabled={updating === s.id}
                        onClick={() => onUpdateStatus(s.id, 'EN_REVISION')}>
                        <Clock size={12} /> Revisión
                      </button>
                    )}
                    {s.status !== 'RECHAZADO' && (
                      <button className="btn btn-danger btn-sm" disabled={updating === s.id}
                        onClick={() => onUpdateStatus(s.id, 'RECHAZADO')}>
                        <XCircle size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Paginación ── */}
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginTop: 4 }}>
        <p className="text-sm text-muted">
          {searched.length} registro{searched.length !== 1 ? 's' : ''}
          {totalPages > 1 && <> · Página {safePage} de {totalPages}</>}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button className="btn btn-ghost btn-sm" disabled={safePage === 1} onClick={() => setPage(1)}>«</button>
            <button className="btn btn-ghost btn-sm" disabled={safePage === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={14} />
            </button>
            {/* Números de página — mostrar ventana de 5 */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - safePage) <= 2)
              .reduce<(number | '…')[]>((acc, n, idx, arr) => {
                if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…')
                acc.push(n)
                return acc
              }, [])
              .map((n, i) =>
                n === '…'
                  ? <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: 'var(--gray-500)', fontSize: 13 }}>…</span>
                  : <button key={n} className={`btn btn-sm ${safePage === n ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ minWidth: 32 }} onClick={() => setPage(n as number)}>
                      {n}
                    </button>
              )
            }
            <button className="btn btn-ghost btn-sm" disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={14} />
            </button>
            <button className="btn btn-ghost btn-sm" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        )}
      </div>
    </>
  )
}

/* ── REPORTS TAB ────────────────────────────────────────────────── */
function ReportsTab({ coloniaStats, streets }: { coloniaStats: ColoniaStats[]; streets: Street[] }) {
  const [expanded, setExpanded]         = useState<string | null>(null)
  
  // ── Línea de tiempo ──────────────────────────────────────────────
  const timelineData = useMemo(() => {
    try {
      const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

      type Bucket = { muy_alta: number; alta: number; media: number; baja: number }
      const buckets: Map<string, Bucket> = new Map()

      const getKey = (iso?: string) => {
        if (!iso) return 'Sin fecha'
        const d = new Date(iso)
        if (isNaN(d.getTime())) return 'Sin fecha'
        const pad = (n: number) => n.toString().padStart(2, '0')
        // Agrupar estrictamente por día (fecha exacta)
        return `${pad(d.getDate())} ${MESES[d.getMonth()]} ${d.getFullYear()}`
      }

      const sorted = [...streets].sort((a, b) => {
        const t1 = a.created_at ? new Date(a.created_at).getTime() : 0
        const t2 = b.created_at ? new Date(b.created_at).getTime() : 0
        return t1 - t2
      })

      for (const s of sorted) {
        const key = getKey(s.created_at)
        if (!buckets.has(key)) buckets.set(key, { muy_alta: 0, alta: 0, media: 0, baja: 0 })
        const b = buckets.get(key)!
        if      (s.priority === 'MUY_ALTA') b.muy_alta++
        else if (s.priority === 'ALTA')     b.alta++
        else if (s.priority === 'MEDIA')    b.media++
        else                                b.baja++
      }

      const labels = Array.from(buckets.keys())
      const values = Array.from(buckets.values())

      return {
        labels,
        datasets: [
          { label: 'Muy Alta', data: values.map(v => v.muy_alta), backgroundColor: '#ef4444' },
          { label: 'Alta',     data: values.map(v => v.alta),     backgroundColor: '#f97316' },
          { label: 'Media',    data: values.map(v => v.media),    backgroundColor: '#eab308' },
          { label: 'Baja',     data: values.map(v => v.baja),     backgroundColor: '#22c55e' },
        ],
      }
    } catch (err) {
      console.error('[ReportsTab] Error en línea de tiempo:', err)
      return { labels: [], datasets: [] }
    }
  }, [streets])

  const totalTimeline = streets.length

  // ── Gráfica por colonia ──────────────────────────────────────────
  const barData = {
    labels: coloniaStats.slice(0, 8).map(c => c.colonia),
    datasets: [
      { label: 'Muy Alta', data: coloniaStats.slice(0, 8).map(c => c.muy_alta), backgroundColor: '#ef4444' },
      { label: 'Alta',     data: coloniaStats.slice(0, 8).map(c => c.alta),     backgroundColor: '#f97316' },
      { label: 'Media',    data: coloniaStats.slice(0, 8).map(c => c.media),    backgroundColor: '#eab308' },
      { label: 'Baja',     data: coloniaStats.slice(0, 8).map(c => c.baja),     backgroundColor: '#22c55e' },
    ],
  }

  return (
    <>
      <h2 className="text-xl font-bold">Reportes por Colonia</h2>

      {/* ── LÁNEA DE TIEMPO ── */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="font-semi" style={{ fontSize: 15 }}>Línea de Tiempo de Reportes</h3>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
              {totalTimeline} reporte{totalTimeline !== 1 ? 's' : ''} en total · agrupados por fecha exacta
            </p>
          </div>
        </div>

        {streets.length === 0 ? (
          <p className="text-muted text-center" style={{ padding: 40 }}>Sin datos para mostrar</p>
        ) : (
          <Bar
            data={{
              labels: timelineData.labels,
              datasets: timelineData.datasets,
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { labels: { color: '#94a3b8', font: { size: 12 }, boxWidth: 12 } },
                tooltip: {
                  callbacks: {
                    title: ctx => `📅 ${ctx[0].label}`,
                    afterBody: (ctx) => {
                      const total = ctx.reduce((s, c) => s + (c.parsed.y || 0), 0)
                      return [`─────────`, `Total: ${total} reporte${total !== 1 ? 's' : ''}`]
                    },
                  },
                },
              },
              scales: {
                x: { stacked: true, ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
                y: {
                  stacked: true,
                  ticks: { color: '#94a3b8', stepSize: 1 },
                  grid: { color: 'rgba(255,255,255,0.05)' },
                  title: { display: true, text: 'Número de reportes', color: '#64748b', font: { size: 11 } },
                },
              },
            }}
          />
        )}
      </div>


      {/* ── GRÁFICA POR COLONIA ── */}
      {coloniaStats.length > 0 && (
        <div className="card">
          <h3 className="font-semi mb-4" style={{ fontSize: 15 }}>Distribución de Prioridades por Colonia</h3>
          <Bar data={barData} options={{
            responsive: true,
            scales: {
              x: { stacked: true, ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
              y: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
            },
            plugins: { legend: { labels: { color: '#94a3b8', font: { size: 12 } } } },
          }} />
        </div>
      )}

      {/* ── DETALLE POR COLONIA ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {coloniaStats.length === 0 && <p className="text-muted text-center" style={{ padding: 40 }}>Sin datos registrados</p>}
        {coloniaStats.map(col => (
          <div key={col.colonia} className="card" style={{ padding: 0 }}>
            <button onClick={() => setExpanded(expanded === col.colonia ? null : col.colonia)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit',
            }}>
              <div className="flex items-center gap-4">
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, textAlign: 'left' }}>{col.colonia}</p>
                  <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                    {col.total_calles} calles · {col.total_viviendas.toLocaleString()} familias
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div style={{ display: 'flex', gap: 8 }}>
                  {col.muy_alta > 0 && <span className="badge badge-muy-alta">{col.muy_alta} Muy Alta</span>}
                  {col.alta > 0     && <span className="badge badge-alta">{col.alta} Alta</span>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--brand-400)' }}>{col.avg_score}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray-500)' }}>score prom.</div>
                </div>
                {expanded === col.colonia
                  ? <ChevronUp size={16} color="var(--gray-400)" />
                  : <ChevronDown size={16} color="var(--gray-400)" />}
              </div>
            </button>
            {expanded === col.colonia && (
              <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--surface-border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
                  {[
                    { label: 'Muy Alta', val: col.muy_alta, color: '#ef4444' },
                    { label: 'Alta',     val: col.alta,     color: '#f97316' },
                    { label: 'Media',    val: col.media,    color: '#eab308' },
                    { label: 'Baja',     val: col.baja,     color: '#22c55e' },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: 'var(--surface-card2)', borderRadius: 8, padding: 12, textAlign: 'center',
                      border: `1px solid ${item.color}30`,
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.val}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--surface-card2)', borderRadius: 8 }}>
                  <p style={{ fontSize: 13 }}>
                    Si se pavimentaran todas las calles de <strong>{col.colonia}</strong>, se beneficiarían{' '}
                    <strong style={{ color: 'var(--brand-400)' }}>{col.total_viviendas.toLocaleString()} familias</strong>.
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

/* ── CONFIG TAB ─────────────────────────────────────────────────── */
function ConfigTab({ weights, setWeights, userEmail }: {
  weights: PriorityWeights
  setWeights: (w: PriorityWeights) => void
  userEmail: string
}) {
  const [local, setLocal] = useState<PriorityWeights>({ ...weights })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  const set = (key: keyof PriorityWeights, value: number) =>
    setLocal(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true); setError('')
    const ok = await saveWeights(local)
    setSaving(false)
    if (ok) { setWeights(local); setSaved(true); setTimeout(() => setSaved(false), 3000) }
    else setError('No se pudieron guardar los cambios. Verifica tu conexión.')
  }

  const handleReset = () =>
    setLocal({ ...DEFAULT_WEIGHTS, id: weights.id, updated_at: weights.updated_at })

  const totalMax = maxScore(local)

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Configuración del Algoritmo</h2>
          <p className="text-sm text-muted" style={{ marginTop: 4 }}>
            Ajusta los pesos de cada criterio. Los cambios afectan cómo se calcula la prioridad de nuevos reportes.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={handleReset}>
            <RotateCcw size={14} /> Restaurar defaults
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Guardando...</> : <><Save size={14} /> Guardar cambios</>}
          </button>
        </div>
      </div>
      {saved  && <div className="alert alert-success animate-fade-in-up">✅ Pesos guardados correctamente por <strong>{userEmail}</strong></div>}
      {error  && <div className="alert alert-error">{error}</div>}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.08))', border: '1.5px solid rgba(59,130,246,0.25)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>Score máximo teórico con la configuración actual</p>
            <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--brand-400)' }}>{totalMax} pts</p>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', textAlign: 'right' }}>
            <p>Umbrales actuales:</p>
            <p>🔴 Muy Alta: ≥{local.umbral_muy_alta} pts</p>
            <p>🟠 Alta: ≥{local.umbral_alta} pts</p>
            <p>🟡 Media: ≥{local.umbral_media} pts</p>
            <p>🟢 Baja: &lt;{local.umbral_media} pts</p>
          </div>
        </div>
      </div>
      {WEIGHT_GROUPS.map(group => (
        <div key={group.label} className="card">
          <h3 className="font-semi mb-4" style={{ fontSize: 14, color: 'var(--brand-300)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {group.label}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {group.keys.map(key => (
              <div key={key as string} className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>
                  {WEIGHT_LABELS[key as keyof typeof WEIGHT_LABELS]}
                </label>
                <input className="form-input" type="number" min="0" max="100"
                  value={(local as any)[key]}
                  onChange={e => set(key, parseInt(e.target.value) || 0)} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="card" style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.2)' }}>
        <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>
          ⚠️ <strong>Nota:</strong> Cambiar los pesos afecta la prioridad de futuros reportes, pero no recalcula automáticamente los registros existentes.
        </p>
      </div>
    </>
  )
}

/* ── STREET DETAIL MODAL ────────────────────────────────────────── */
function StreetModal({ street, onClose, onUpdateStatus, updating, userEmail }: {
  street: Street
  onClose: () => void
  onUpdateStatus: (id: string, s: Status, notes?: string) => void
  updating: string | null
  userEmail: string
}) {
  const [lightbox, setLightbox]             = useState<number | null>(null)
  const [notes, setNotes]                   = useState(street.admin_notes ?? '')
  const [history, setHistory]               = useState<StatusHistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const hasPhotos = street.photo_urls && street.photo_urls.length > 0

  useEffect(() => {
    setLoadingHistory(true)
    supabase
      .from('status_history')
      .select('*')
      .eq('street_id', street.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setHistory(data as StatusHistoryEntry[]); setLoadingHistory(false) })
  }, [street.id])

  const prevPhoto = () => setLightbox(i => i !== null && i > 0 ? i - 1 : street.photo_urls.length - 1)
  const nextPhoto = () => setLightbox(i => i !== null && i < street.photo_urls.length - 1 ? i + 1 : 0)

  const handleStatusChange = (status: Status) => {
    onUpdateStatus(street.id, status, notes)
    setHistory(prev => [{
      id: crypto.randomUUID(), created_at: new Date().toISOString(),
      street_id: street.id, old_status: street.status, new_status: status,
      changed_by: userEmail, notes,
    }, ...prev])
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const mapsUrl = `https://www.google.com/maps?q=${street.lat},${street.lng}`

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        backdropFilter: 'blur(4px)',
      }}>
        <div onClick={e => e.stopPropagation()} className="card animate-fade-in-up"
          style={{ maxWidth: 580, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 style={{ fontWeight: 700, fontSize: 18 }}>{street.street_name}</h3>
              <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>{street.colonia}</p>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span className={`badge badge-${street.priority.toLowerCase().replace('_', '-')}`}>● {priorityLabels[street.priority]}</span>
            <span className={`badge badge-${street.status.toLowerCase().replace('_', '-')}`}>{statusConfig[street.status]?.label}</span>
            <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--brand-400)', border: '1px solid rgba(59,130,246,0.3)' }}>
              Score: {street.impact_score}/120
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Tipo de vía',    val: street.via_type },
              { label: 'Tráfico',        val: street.traffic_type },
              { label: 'Longitud',       val: `${street.length_m} m` },
              { label: 'Viviendas',      val: street.num_viviendas },
              { label: 'Riesgo lluvias', val: `${street.rain_risk}/5` },
              { label: 'Reportado por',  val: street.reporter_name || '—' },
              { label: 'Correo',         val: street.reporter_email || street.reporter_phone || '—' },
              { label: 'Fecha reporte',  val: new Date(street.created_at).toLocaleDateString('es-MX') },
            ].map(item => (
              <div key={item.label} style={{ background: 'var(--surface-card2)', borderRadius: 8, padding: '10px 14px' }}>
                <p style={{ fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</p>
                <p style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{item.val}</p>
              </div>
            ))}
          </div>

          {/* Enlace a Google Maps */}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 8, fontSize: 13, color: 'var(--brand-300)', textDecoration: 'none',
            marginBottom: 16, fontWeight: 600, transition: 'background 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.07)')}
          >
            📍 Ver en Google Maps
            <span style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 400, marginLeft: 'auto' }}>
              {street.lat.toFixed(5)}, {street.lng.toFixed(5)}
            </span>
          </a>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {street.near_school    && <span className="badge" style={{ background: 'rgba(34,197,94,0.1)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)' }}>🏫 Escuela</span>}
            {street.near_hospital  && <span className="badge" style={{ background: 'rgba(34,197,94,0.1)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)' }}>🏥 Hospital</span>}
            {street.near_market    && <span className="badge" style={{ background: 'rgba(34,197,94,0.1)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)' }}>🛒 Mercado</span>}
            {street.near_transport && <span className="badge" style={{ background: 'rgba(34,197,94,0.1)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)' }}>🚌 Transporte</span>}
          </div>

          {street.description && (
            <div style={{ background: 'var(--surface-card2)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 6 }}>Descripción ciudadana</p>
              <p style={{ fontSize: 13 }}>{street.description}</p>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontSize: 12 }}>Notas del administrador</label>
            <textarea className="form-textarea" rows={2} style={{ fontSize: 13 }}
              placeholder="Agrega observaciones internas sobre este reporte..."
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div style={{ marginBottom: 16 }}>
            {hasPhotos ? (
              <>
                <button onClick={() => setLightbox(0)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 10, padding: '13px 20px',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))',
                  border: '1.5px solid rgba(59,130,246,0.4)', borderRadius: 'var(--radius-md)',
                  color: 'var(--brand-300)', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(99,102,241,0.25))')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))')}
                >
                  <Eye size={18} /> Ver Evidencia Fotográfica
                  <span style={{ background: 'var(--brand-500)', color: '#fff', borderRadius: 'var(--radius-full)', padding: '2px 9px', fontSize: 12, fontWeight: 800 }}>
                    {street.photo_urls.length} {street.photo_urls.length === 1 ? 'foto' : 'fotos'}
                  </span>
                </button>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
                  {street.photo_urls.map((url, i) => (
                    <div key={i} onClick={() => setLightbox(i)} style={{
                      width: 64, height: 64, flexShrink: 0, borderRadius: 8, overflow: 'hidden',
                      cursor: 'pointer', border: '2px solid rgba(59,130,246,0.3)', transition: 'transform 0.2s, border-color 0.2s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand-400)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)';   (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.3)' }}
                    >
                      <img src={url} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ padding: '13px 20px', background: 'var(--surface-card2)', border: '1.5px solid var(--surface-border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--gray-500)', fontSize: 13 }}>
                <Eye size={16} /> Sin evidencia fotográfica adjunta
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Historial de cambios
            </p>
            {loadingHistory ? (
              <p className="text-muted" style={{ fontSize: 12 }}>Cargando historial...</p>
            ) : history.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 12 }}>Sin cambios registrados aún.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.map(entry => (
                  <div key={entry.id} style={{
                    background: 'var(--surface-card2)', borderRadius: 8, padding: '10px 14px',
                    borderLeftWidth: 3, borderLeftStyle: 'solid',
                    borderLeftColor: entry.new_status === 'APROBADO' ? '#22c55e' : entry.new_status === 'RECHAZADO' ? '#ef4444' : entry.new_status === 'EN_REVISION' ? '#eab308' : '#94a3b8',
                  }}>
                    <div className="flex items-center justify-between">
                      <span className={`badge badge-${entry.new_status.toLowerCase().replace('_', '-')}`} style={{ fontSize: 11 }}>
                        {statusConfig[entry.new_status]?.label ?? entry.new_status}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{formatDate(entry.created_at)}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
                      Por <strong>{entry.changed_by}</strong>
                      {entry.old_status && <> · Antes: {statusConfig[entry.old_status as Status]?.label}</>}
                    </p>
                    {entry.notes && <p style={{ fontSize: 12, color: 'var(--gray-300)', marginTop: 4, fontStyle: 'italic' }}>"{entry.notes}"</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2" style={{ paddingTop: 16, borderTop: '1px solid var(--surface-border)' }}>
            <button className="btn btn-success" disabled={updating === street.id || street.status === 'APROBADO'} onClick={() => handleStatusChange('APROBADO')}>
              <CheckCircle size={14} /> Aprobar
            </button>
            <button className="btn btn-warning" disabled={updating === street.id || street.status === 'EN_REVISION'} onClick={() => handleStatusChange('EN_REVISION')}>
              <Clock size={14} /> En Revisión
            </button>
            <button className="btn btn-danger" disabled={updating === street.id || street.status === 'RECHAZADO'} onClick={() => handleStatusChange('RECHAZADO')}>
              <XCircle size={14} /> Rechazar
            </button>
          </div>
        </div>
      </div>

      {lightbox !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onKeyDown={e => { if (e.key === 'ArrowLeft') prevPhoto(); if (e.key === 'ArrowRight') nextPhoto(); if (e.key === 'Escape') setLightbox(null) }}
          tabIndex={0} autoFocus>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15 }}>{street.street_name}</p>
              <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>📷 Foto {lightbox + 1} de {street.photo_urls.length}</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href={street.photo_urls[lightbox]} download target="_blank" rel="noopener noreferrer"
                style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                ⬇ Descargar
              </a>
              <button onClick={() => setLightbox(null)}
                style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
          </div>
          <img src={street.photo_urls[lightbox]} alt={`Foto ${lightbox + 1}`}
            style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 25px 60px rgba(0,0,0,0.8)' }} />
          {street.photo_urls.length > 1 && (
            <>
              <button onClick={prevPhoto} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
              <button onClick={nextPhoto} style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
            </>
          )}
          {street.photo_urls.length > 1 && (
            <div style={{ position: 'absolute', bottom: 24, display: 'flex', gap: 8 }}>
              {street.photo_urls.map((_, i) => (
                <button key={i} onClick={() => setLightbox(i)} style={{ width: i === lightbox ? 24 : 8, height: 8, borderRadius: 4, background: i === lightbox ? 'var(--brand-400)' : 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', transition: 'all 0.3s' }} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

/* ── KANBAN TAB ─────────────────────────────────────────────────── */
function KanbanTab({ streets, onUpdateStatus, updating, onSelectStreet }: {
  streets: Street[]
  onUpdateStatus: (id: string, s: Status) => void
  updating: string | null
  onSelectStreet: (s: Street) => void
}) {
  const columns: { status: Status; label: string; color: string; bg: string }[] = [
    { status: 'PENDIENTE',   label: 'Pendiente',   color: '#94a3b8', bg: 'rgba(148,163,184,0.06)' },
    { status: 'EN_REVISION', label: 'En Revisión', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)'  },
    { status: 'APROBADO',    label: 'Aprobado',    color: '#22c55e', bg: 'rgba(34,197,94,0.06)'   },
    { status: 'RECHAZADO',   label: 'Rechazado',   color: '#ef4444', bg: 'rgba(239,68,68,0.06)'   },
  ]

  return (
    <>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 className="text-xl font-bold">Vista Kanban</h2>
        <p className="text-sm text-muted">{streets.length} reportes · Haz clic en una tarjeta para ver el detalle</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'start' }}>
        {columns.map(col => {
          const colStreets = streets.filter(s => s.status === col.status)
          return (
            <div key={col.status} style={{
              background: col.bg,
              border: `1.5px solid ${col.color}25`,
              borderRadius: 'var(--radius-md)',
              padding: 12,
              minHeight: 180,
            }}>
              {/* Cabecera de columna */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: col.color }} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{col.label}</span>
                </div>
                <span style={{
                  background: `${col.color}22`, color: col.color,
                  borderRadius: '999px', fontSize: 11, fontWeight: 800, padding: '1px 8px',
                }}>{colStreets.length}</span>
              </div>

              {/* Tarjetas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colStreets.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--gray-600)', fontSize: 12, fontStyle: 'italic' }}>
                    Sin reportes
                  </div>
                )}
                {colStreets.map(s => (
                  <div key={s.id} onClick={() => onSelectStreet(s)}
                    style={{
                      background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
                      borderRadius: 8, padding: '11px 12px', cursor: 'pointer',
                      borderLeft: `3px solid ${priorityColors[s.priority]}`,
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(-2px)'
                      el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.35)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = ''
                      el.style.boxShadow = ''
                    }}
                  >
                    <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{s.street_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 8 }}>{s.colonia}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: priorityColors[s.priority] }}>
                        ● {priorityLabels[s.priority]}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: priorityColors[s.priority] }}>
                        {s.impact_score} pts
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 10 }}>🏠 {s.num_viviendas} familias</div>
                    {/* Botones de acción rápida */}
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      {s.status !== 'APROBADO' && (
                        <button className="btn btn-success btn-sm" style={{ flex: 1, fontSize: 10, padding: '3px 4px' }}
                          disabled={updating === s.id} onClick={() => onUpdateStatus(s.id, 'APROBADO')}>
                          <CheckCircle size={10} /> Aprobar
                        </button>
                      )}
                      {s.status !== 'EN_REVISION' && (
                        <button className="btn btn-warning btn-sm" style={{ flex: 1, fontSize: 10, padding: '3px 4px' }}
                          disabled={updating === s.id} onClick={() => onUpdateStatus(s.id, 'EN_REVISION')}>
                          <Clock size={10} /> Revisión
                        </button>
                      )}
                      {s.status !== 'RECHAZADO' && (
                        <button className="btn btn-danger btn-sm" style={{ fontSize: 10, padding: '3px 6px' }}
                          disabled={updating === s.id} onClick={() => onUpdateStatus(s.id, 'RECHAZADO')}>
                          <XCircle size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ── USERS TAB (Admin crea y gestiona presidentes) ──────────────── */
function UsersTab({ colonias }: { colonias: string[] }) {
  const [profiles, setProfiles]       = useState<UserProfile[]>([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [editProfile, setEditProfile] = useState<UserProfile | null>(null)
  // Campos del formulario
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [colonia, setColonia]         = useState('')
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState('')
  const [saveOk, setSaveOk]           = useState('')
  const [noServiceKey, setNoServiceKey] = useState(false)

  const load = async () => {
    setLoading(true)
    const data = await fetchAllProfiles()
    setProfiles(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditProfile(null)
    setEmail(''); setPassword(''); setColonia('')
    setSaveError(''); setSaveOk('')
    setShowModal(true)
  }

  const openEdit = (p: UserProfile) => {
    setEditProfile(p)
    setEmail(p.display_name ?? '')
    setPassword(''); setColonia(p.colonia ?? '')
    setSaveError(''); setSaveOk('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaveError('')
    if (!colonia) { setSaveError('Selecciona una colonia.'); return }

    if (editProfile) {
      // Solo actualizar colonia
      setSaving(true)
      const { error } = await upsertProfile({
        user_id: editProfile.user_id,
        role: 'presidente_colonia',
        colonia,
        display_name: editProfile.display_name ?? '',
      })
      setSaving(false)
      if (error) { setSaveError(error); return }
      setSaveOk('✅ Colonia actualizada correctamente')
      setShowModal(false); load()
      return
    }

    // Crear nuevo presidente
    if (!email.trim()) { setSaveError('Ingresa el correo electrónico.'); return }
    if (password.length < 6) { setSaveError('La contraseña debe tener al menos 6 caracteres.'); return }

    // Importar cliente admin dinámicamente
    const { supabaseAdmin } = await import('../lib/supabaseAdmin')

    if (!supabaseAdmin) {
      setNoServiceKey(true)
      setSaveError('⚠️ Falta la Service Role Key. Ve las instrucciones abajo.')
      return
    }

    setSaving(true)
    // 1. Crear usuario en Supabase Auth
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // Confirmar email automáticamente (sin necesitar confirmación)
    })

    if (authError || !userData.user) {
      setSaveError(authError?.message ?? 'Error al crear la cuenta.')
      setSaving(false); return
    }

    // 2. Crear perfil en user_profiles
    const { error: profileError } = await upsertProfile({
      user_id: userData.user.id,
      role: 'presidente_colonia',
      colonia,
      display_name: email.trim().toLowerCase(),
    })

    setSaving(false)
    if (profileError) { setSaveError(profileError); return }

    setSaveOk(`✅ Presidente creado: ${email}`)
    setShowModal(false); load()
  }

  const handleRevoke = async (p: UserProfile) => {
    if (!confirm(`¿Eliminar el acceso de presidente a ${p.display_name ?? p.user_id}?`)) return
    await deleteProfile(p.user_id)
    load()
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 className="text-xl font-bold">Presidentes de Colonia</h2>
          <p className="text-muted text-sm">El administrador crea las cuentas — los presidentes solo inician sesión</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Users size={15} /> + Nuevo Presidente
        </button>
      </div>

      {saveOk && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {saveOk}
        </div>
      )}

      {/* Aviso si falta Service Key */}
      {noServiceKey && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: 20,
        }}>
          <p style={{ fontWeight: 700, color: '#ef4444', marginBottom: 10 }}>⚠️ Falta configurar la Service Role Key</p>
          <p style={{ fontSize: 13, color: 'var(--gray-300)', lineHeight: 1.7, marginBottom: 8 }}>
            Para que el admin pueda crear cuentas directamente, agrega esta variable al archivo <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>.env.local</code>:
          </p>
          <code style={{
            display: 'block', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 8,
            fontSize: 12, color: '#86efac', fontFamily: 'monospace', marginBottom: 8,
          }}>
            VITE_SUPABASE_SERVICE_KEY=tu_service_role_key_aqui
          </code>
          <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>
            La encuentras en: <strong>Supabase → Settings → API → service_role (secret)</strong>
          </p>
        </div>
      )}

      {/* Info del flujo */}
      <div style={{
        background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 'var(--radius-md)', padding: '12px 18px', marginBottom: 20,
      }}>
        <p style={{ fontSize: 13, color: 'var(--gray-300)', lineHeight: 1.7 }}>
          <strong style={{ color: '#22c55e' }}>🔒 Flujo seguro:</strong>{' '}
          Tú creas el email y contraseña del presidente → le das sus credenciales en persona →
          él entra a <code style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 4 }}>/login</code> y ve solo su colonia.
          Sin registro público.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Colonia Asignada</th>
                <th>Rol</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-500)' }}>
                  No hay presidentes creados aún — usa "+ Nuevo Presidente"
                </td></tr>
              )}
              {profiles.map(p => (
                <tr key={p.id}>
                  <td>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{p.display_name ?? '—'}</p>
                    <p style={{ fontSize: 11, color: 'var(--gray-500)', fontFamily: 'monospace' }}>{p.user_id.slice(0, 12)}…</p>
                  </td>
                  <td>
                    {p.colonia
                      ? <span style={{ fontWeight: 700, color: 'var(--brand-300)', fontSize: 13 }}>🏘️ {p.colonia}</span>
                      : <span style={{ color: 'var(--gray-500)', fontSize: 12, fontStyle: 'italic' }}>Sin colonia</span>
                    }
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                      background: p.role === 'admin' ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)',
                      color: p.role === 'admin' ? 'var(--brand-300)' : '#c084fc',
                    }}>
                      {p.role === 'admin' ? '👑 Admin' : '🏘️ Presidente'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                    {new Date(p.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️ Cambiar colonia</button>
                      {p.role !== 'admin' && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleRevoke(p)}>🚫 Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20,
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', padding: 28,
            width: '100%', maxWidth: 460, border: '1px solid var(--surface-border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 800, fontSize: 16, marginBottom: 20 }}>
              {editProfile ? '✏️ Cambiar Colonia del Presidente' : '➕ Crear Nuevo Presidente'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Email — bloqueado si editando */}
              <div className="form-group">
                <label className="form-label">Correo electrónico</label>
                <input className="form-input" type="email" placeholder="presidente@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  disabled={!!editProfile}
                  style={editProfile ? { opacity: 0.6, cursor: 'not-allowed' } : {}} />
              </div>

              {/* Contraseña — solo al crear */}
              {!editProfile && (
                <div className="form-group">
                  <label className="form-label">Contraseña (mínimo 6 caracteres)</label>
                  <input className="form-input" type="password" placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} />
                  <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>
                    Entrégale esta contraseña al presidente en persona o por canal seguro.
                  </p>
                </div>
              )}

              {/* Colonia */}
              <div className="form-group">
                <label className="form-label">Colonia a gestionar</label>
                <select className="form-select" value={colonia} onChange={e => setColonia(e.target.value)}>
                  <option value="">Seleccionar colonia...</option>
                  {COLONIAS_ZIHUA.map(c => c.nombre).sort().map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {saveError && (
                <div className="alert alert-error" style={{ fontSize: 13 }}>{saveError}</div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button className="btn btn-primary" style={{ flex: 1 }}
                  onClick={handleSave} disabled={saving}>
                  {saving
                    ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Creando cuenta...</>
                    : editProfile ? '✅ Guardar cambios' : '➕ Crear Presidente'
                  }
                </button>
                <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

