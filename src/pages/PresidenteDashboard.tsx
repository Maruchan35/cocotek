import { useEffect, useState, useMemo } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { signOut } from '../lib/auth'
import { DashboardMap } from '../components/MapView'
import { priorityLabels, priorityColors, calculatePriority } from '../lib/priorityEngine'
import { COLONIAS_ZIHUA } from '../lib/coloniaData'
import type { Street, Status, UserProfile, ViaType, TrafficType } from '../types'
import {
  LayoutDashboard, Map, TableProperties, LogOut, RefreshCw,
  CheckCircle, Clock, Home, Plus, Eye, X, Save, AlertCircle,
  ChevronLeft, ChevronRight, MapPin, Users, FileCheck,
} from 'lucide-react'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from 'chart.js'
ChartJS.register(ArcElement, Tooltip, Legend)

type PresTab = 'overview' | 'map' | 'reports' | 'add'

const STATUS_CONFIG = {
  PENDIENTE:   { label: 'Pendiente',   cls: 'badge-pendiente'  },
  EN_REVISION: { label: 'En Revisión', cls: 'badge-revision'   },
  APROBADO:    { label: 'Aprobado',    cls: 'badge-aprobado'   },
  RECHAZADO:   { label: 'Rechazado',   cls: 'badge-rechazado'  },
}

const EMPTY_FORM = {
  street_name: '', length_m: 100, via_type: '' as ViaType | '',
  traffic_type: '' as TrafficType | '', num_viviendas: 10,
  near_school: false, near_hospital: false, near_market: false, near_transport: false,
  rain_risk: 1, description: '', lat: null as number | null, lng: null as number | null,
}

export default function PresidenteDashboard({ session, profile }: { session: Session; profile: UserProfile }) {
  const colonia = profile.colonia ?? 'Sin colonia asignada'
  const [streets, setStreets]           = useState<Street[]>([])
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState<PresTab>('overview')
  const [selectedStreet, setSelectedStreet] = useState<Street | null>(null)
  const [page, setPage]                 = useState(1)
  const PAGE_SIZE = 12

  // Formulario agregar calle
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [submitting, setSubmitting]     = useState(false)
  const [submitOk, setSubmitOk]         = useState(false)
  const [submitError, setSubmitError]   = useState('')

  const fetchStreets = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('streets')
      .select('*')
      .eq('colonia', colonia)
      .order('impact_score', { ascending: false })
    if (!error && data) setStreets(data as Street[])
    setLoading(false)
  }

  useEffect(() => { fetchStreets() }, [colonia])

  const stats = useMemo(() => ({
    total:     streets.length,
    pendiente: streets.filter(s => s.status === 'PENDIENTE').length,
    aprobado:  streets.filter(s => s.status === 'APROBADO').length,
    muy_alta:  streets.filter(s => s.priority === 'MUY_ALTA').length,
    familias:  streets.reduce((a, b) => a + b.num_viviendas, 0),
  }), [streets])

  const totalPages = Math.max(1, Math.ceil(streets.length / PAGE_SIZE))
  const paginated  = streets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Guardar nota de corroboración
  const corroborar = async (street: Street, nota: string) => {
    const prefix = `[PRESIDENTE ${colonia}]: `
    const newNote = prefix + nota.trim()
    const combined = street.admin_notes
      ? `${street.admin_notes}\n${newNote}`
      : newNote
    await supabase.from('streets').update({ admin_notes: combined }).eq('id', street.id)
    setStreets(prev => prev.map(s => s.id === street.id ? { ...s, admin_notes: combined } : s))
    if (selectedStreet?.id === street.id) setSelectedStreet(s => s ? { ...s, admin_notes: combined } : null)
  }

  // Enviar formulario de nueva calle
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true); setSubmitError('')
    if (!form.via_type || !form.traffic_type) {
      setSubmitError('Selecciona tipo de vía y tipo de tráfico.'); setSubmitting(false); return
    }
    const { score } = calculatePriority({
      length_m: form.length_m, via_type: form.via_type as ViaType,
      traffic_type: form.traffic_type as TrafficType, num_viviendas: form.num_viviendas,
      near_school: form.near_school, near_hospital: form.near_hospital,
      near_market: form.near_market, near_transport: form.near_transport,
      rain_risk: form.rain_risk,
    })
    const priority = score >= 90 ? 'MUY_ALTA' : score >= 65 ? 'ALTA' : score >= 40 ? 'MEDIA' : 'BAJA'
    const { error } = await supabase.from('streets').insert({
      street_name: form.street_name.trim(),
      colonia,
      lat: form.lat ?? 17.6393,
      lng: form.lng ?? -101.5539,
      length_m: form.length_m,
      via_type: form.via_type,
      traffic_type: form.traffic_type,
      num_viviendas: form.num_viviendas,
      near_school: form.near_school, near_hospital: form.near_hospital,
      near_market: form.near_market, near_transport: form.near_transport,
      rain_risk: form.rain_risk,
      description: form.description,
      photo_urls: [],
      impact_score: score,
      priority,
      status: 'PENDIENTE',
      admin_notes: `[Agregada por Presidente de Colonia ${colonia}]`,
      reporter_name: profile.display_name ?? session.user.email ?? 'Presidente',
      reporter_phone: '',
    })
    if (error) { setSubmitError(error.message); setSubmitting(false); return }
    setSubmitOk(true); setForm(EMPTY_FORM)
    fetchStreets()
    setSubmitting(false)
    setTimeout(() => setSubmitOk(false), 4000)
  }

  const sidebarItems: { key: PresTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Mi Colonia',    icon: <Home size={16} /> },
    { key: 'map',      label: 'Mapa',          icon: <Map size={16} /> },
    { key: 'reports',  label: 'Mis Reportes',  icon: <TableProperties size={16} /> },
    { key: 'add',      label: 'Agregar Calle', icon: <Plus size={16} /> },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* NAVBAR */}
      <header className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">🏘️</div>
          <div>
            <div className="navbar-title">{colonia}</div>
            <div className="navbar-subtitle">Panel Presidente de Colonia</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{session.user.email}</div>
          <button className="btn btn-ghost btn-sm" onClick={fetchStreets}><RefreshCw size={14} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => signOut()}><LogOut size={14} /></button>
        </div>
      </header>

      <div className="dashboard-layout">
        {/* SIDEBAR */}
        <nav className="sidebar">
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-600)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 16px', marginBottom: 4 }}>
            Navegación
          </p>
          {sidebarItems.map(item => (
            <button key={item.key} className={`sidebar-item ${tab === item.key ? 'active' : ''}`}
              onClick={() => setTab(item.key)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                {item.icon} {item.label}
                {item.key === 'reports' && stats.pendiente > 0 && (
                  <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: 10, fontWeight: 800, padding: '1px 7px' }}>
                    {stats.pendiente}
                  </span>
                )}
              </span>
            </button>
          ))}
          <div className="divider" style={{ margin: '12px 0' }} />
          <div style={{ padding: '8px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Mi colonia</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-300)', marginBottom: 2 }}>{colonia}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{stats.total} reportes registrados</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--gray-600)', borderTop: '1px solid var(--surface-border)' }}>
            🔒 Acceso limitado a {colonia}
          </div>
        </nav>

        {/* CONTENIDO */}
        <main className="main-content">
          {loading ? (
            <div className="flex items-center justify-center" style={{ height: 300 }}>
              <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
                <p className="text-muted">Cargando reportes de {colonia}...</p>
              </div>
            </div>
          ) : (
            <>
              {tab === 'overview' && <OverviewTab stats={stats} streets={streets} colonia={colonia} />}
              {tab === 'map' && <MapTab streets={streets} colonia={colonia} onSelect={setSelectedStreet} />}
              {tab === 'reports' && (
                <ReportsTab
                  streets={paginated} allStreets={streets} colonia={colonia}
                  page={page} totalPages={totalPages} setPage={setPage}
                  onSelect={setSelectedStreet}
                />
              )}
              {tab === 'add' && (
                <AddStreetTab
                  colonia={colonia} form={form} setForm={setForm}
                  onSubmit={handleSubmit} submitting={submitting}
                  submitOk={submitOk} submitError={submitError}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* MODAL DETALLE */}
      {selectedStreet && (
        <StreetDetailModal
          street={selectedStreet}
          colonia={colonia}
          onClose={() => setSelectedStreet(null)}
          onCorroborar={corroborar}
        />
      )}
    </div>
  )
}

// ── OVERVIEW ─────────────────────────────────────────────────────
function OverviewTab({ stats, streets, colonia }: { stats: any; streets: Street[]; colonia: string }) {
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
      borderWidth: 2,
      borderColor: 'var(--surface-card)',
    }],
  }

  const kpis = [
    { label: 'Reportes totales',    value: stats.total,     icon: '📋', color: '#3b82f6' },
    { label: 'Sin revisar',         value: stats.pendiente, icon: '⏳', color: '#f59e0b' },
    { label: 'Aprobadas',           value: stats.aprobado,  icon: '✅', color: '#22c55e' },
    { label: 'Prioridad Muy Alta',  value: stats.muy_alta,  icon: '🔴', color: '#ef4444' },
    { label: 'Familias afectadas',  value: stats.familias,  icon: '🏠', color: '#8b5cf6' },
  ]

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h2 className="text-xl font-bold" style={{ marginBottom: 4 }}>🏘️ {colonia}</h2>
        <p className="text-muted text-sm">Panel exclusivo del Presidente de Colonia — solo ves tu colonia</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{k.icon}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Gráfica + tabla de prioridades */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 className="font-semi mb-4" style={{ fontSize: 14 }}>Distribución por Prioridad</h3>
          {streets.length > 0 ? (
            <div style={{ maxWidth: 260, margin: '0 auto' }}>
              <Doughnut data={doughnutData} options={{
                plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
                cutout: '65%',
              }} />
            </div>
          ) : (
            <p className="text-muted text-center" style={{ padding: 32 }}>Sin datos aún</p>
          )}
        </div>

        <div className="card">
          <h3 className="font-semi mb-4" style={{ fontSize: 14 }}>Estado de Reportes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(['PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO'] as Status[]).map(s => {
              const count = streets.filter(r => r.status === s).length
              const pct   = streets.length > 0 ? Math.round(count / streets.length * 100) : 0
              const colors: Record<string, string> = { PENDIENTE: '#94a3b8', EN_REVISION: '#f59e0b', APROBADO: '#22c55e', RECHAZADO: '#ef4444' }
              return (
                <div key={s}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--gray-300)', fontWeight: 600 }}>{STATUS_CONFIG[s].label}</span>
                    <span style={{ color: colors[s], fontWeight: 800 }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-card2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: colors[s], borderRadius: 3, transition: 'width 0.5s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {streets.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 48, marginTop: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <h3 style={{ marginBottom: 8 }}>Sin reportes aún en {colonia}</h3>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Cuando los ciudadanos reporten calles en tu colonia aparecerán aquí.
            También puedes agregar calles directamente desde la pestaña "Agregar Calle".
          </p>
        </div>
      )}
    </>
  )
}

// ── MAP TAB ───────────────────────────────────────────────────────
function MapTab({ streets, colonia, onSelect }: { streets: Street[]; colonia: string; onSelect: (s: Street) => void }) {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h2 className="text-xl font-bold">Mapa — {colonia}</h2>
        <p className="text-muted text-sm">{streets.length} calles en el mapa · Haz clic en un pin para ver detalles</p>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <DashboardMap streets={streets} onSelectStreet={onSelect} />
      </div>
    </>
  )
}

// ── REPORTS TAB ───────────────────────────────────────────────────
function ReportsTab({ streets, allStreets, colonia, page, totalPages, setPage, onSelect }: any) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 className="text-xl font-bold">Mis Reportes — {colonia}</h2>
          <p className="text-muted text-sm">{allStreets.length} calles · Haz clic en una fila para corroborar</p>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Calle / Andador</th>
              <th>Prioridad</th>
              <th>Score</th>
              <th>Viviendas</th>
              <th>Estado</th>
              <th>Verificación</th>
            </tr>
          </thead>
          <tbody>
            {streets.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-500)' }}>
                Sin reportes en {colonia}
              </td></tr>
            )}
            {streets.map((s: Street, i: number) => (
              <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(s)}>
                <td style={{ color: 'var(--gray-500)', fontWeight: 600 }}>{(page - 1) * 12 + i + 1}</td>
                <td>
                  <p style={{ fontWeight: 600, fontSize: 13 }}>{s.street_name}</p>
                  <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>{s.length_m}m · {s.via_type}</p>
                </td>
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
                  <span className={`badge ${STATUS_CONFIG[s.status]?.cls}`}>
                    {STATUS_CONFIG[s.status]?.label}
                  </span>
                </td>
                <td>
                  {s.admin_notes?.includes('[PRESIDENTE') ? (
                    <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>✅ Verificado</span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>Sin verificar</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginTop: 8 }}>
          <p className="text-sm text-muted">{allStreets.length} registros · Página {page} de {totalPages}</p>
          <div className="flex items-center gap-1">
            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage((p: number) => p - 1)}><ChevronLeft size={14} /></button>
            <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage((p: number) => p + 1)}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </>
  )
}

// ── ADD STREET TAB ────────────────────────────────────────────────
function AddStreetTab({ colonia, form, setForm, onSubmit, submitting, submitOk, submitError }: any) {
  const f = (key: string, val: any) => setForm((prev: any) => ({ ...prev, [key]: val }))

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h2 className="text-xl font-bold">Agregar Calle Nueva</h2>
        <p className="text-muted text-sm">Registra una calle que no aparezca en el sistema — se asignará automáticamente a {colonia}</p>
      </div>

      {submitOk && (
        <div className="alert alert-success" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle size={18} />
          <span>✅ Calle agregada exitosamente. El administrador la revisará pronto.</span>
        </div>
      )}
      {submitError && (
        <div className="alert alert-error" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={18} /><span>{submitError}</span>
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-300)', marginBottom: 4 }}>📍 Información de la Calle</h3>

          {/* Colonia (bloqueada) */}
          <div className="form-group">
            <label className="form-label">Colonia</label>
            <input className="form-input" value={colonia} disabled
              style={{ opacity: 0.6, cursor: 'not-allowed', background: 'var(--surface-card2)' }} />
          </div>

          {/* Nombre */}
          <div className="form-group">
            <label className="form-label">Nombre de la calle / andador <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="form-input" placeholder="Ej: Andador Girasoles" required
              value={form.street_name} onChange={e => f('street_name', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            {/* Longitud */}
            <div className="form-group">
              <label className="form-label">Longitud (metros) <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="form-input" type="number" min={10} max={5000} required
                value={form.length_m} onChange={e => f('length_m', Number(e.target.value))} />
            </div>

            {/* Tipo de vía */}
            <div className="form-group">
              <label className="form-label">Tipo de vía <span style={{ color: '#ef4444' }}>*</span></label>
              <select className="form-select" required value={form.via_type} onChange={e => f('via_type', e.target.value)}>
                <option value="">Seleccionar...</option>
                <option value="andador">Andador</option>
                <option value="secundaria">Calle Secundaria</option>
                <option value="primaria">Calle Primaria</option>
              </select>
            </div>

            {/* Tipo de tráfico */}
            <div className="form-group">
              <label className="form-label">Tráfico <span style={{ color: '#ef4444' }}>*</span></label>
              <select className="form-select" required value={form.traffic_type} onChange={e => f('traffic_type', e.target.value)}>
                <option value="">Seleccionar...</option>
                <option value="peatonal">Peatonal</option>
                <option value="ligero">Ligero</option>
                <option value="pesado">Pesado</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Viviendas */}
            <div className="form-group">
              <label className="form-label">Número de viviendas afectadas <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="form-input" type="number" min={1} max={9999} required
                value={form.num_viviendas} onChange={e => f('num_viviendas', Number(e.target.value))} />
            </div>

            {/* Riesgo de lluvias */}
            <div className="form-group">
              <label className="form-label">Riesgo de inundación (1=bajo, 5=muy alto)</label>
              <input className="form-input" type="number" min={1} max={5}
                value={form.rain_risk} onChange={e => f('rain_risk', Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-300)', marginBottom: 4 }}>🏫 Infraestructura Cercana</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {[
              { key: 'near_school',    label: '🏫 Cerca de escuela'   },
              { key: 'near_hospital',  label: '🏥 Cerca de hospital'  },
              { key: 'near_market',    label: '🛒 Cerca de mercado'   },
              { key: 'near_transport', label: '🚌 Cerca de transporte' },
            ].map(item => (
              <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--gray-200)' }}>
                <input type="checkbox" checked={(form as any)[item.key]}
                  onChange={e => f(item.key, e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--brand-500)' }} />
                {item.label}
              </label>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-300)', marginBottom: 12 }}>📝 Descripción</h3>
          <textarea className="form-input" rows={4}
            placeholder="Describe el estado de la calle, el problema principal, temporada que empeora, etc..."
            value={form.description} onChange={e => f('description', e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        <button type="submit" className="btn btn-primary btn-lg"
          disabled={submitting}
          style={{ alignSelf: 'flex-start', padding: '12px 32px', fontSize: 15, fontWeight: 700 }}>
          {submitting ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Registrando...</> : <><Plus size={18} /> Registrar Calle</>}
        </button>
      </form>
    </>
  )
}

// ── STREET DETAIL MODAL ───────────────────────────────────────────
function StreetDetailModal({ street, colonia, onClose, onCorroborar }: {
  street: Street; colonia: string
  onClose: () => void
  onCorroborar: (street: Street, nota: string) => Promise<void>
}) {
  const [nota, setNota]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const handleCorroborar = async () => {
    if (!nota.trim()) return
    setSaving(true)
    await onCorroborar(street, nota)
    setSaving(false); setSaved(true); setNota('')
    setTimeout(() => setSaved(false), 3000)
  }

  const alreadyVerified = street.admin_notes?.includes('[PRESIDENTE')

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', padding: 28,
        width: '100%', maxWidth: 540, maxHeight: '88vh', overflowY: 'auto',
        border: '1px solid var(--surface-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ borderLeft: `4px solid ${priorityColors[street.priority]}`, paddingLeft: 12 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{street.street_name}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--gray-400)' }}>{colonia}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Info básica */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Prioridad', value: priorityLabels[street.priority], color: priorityColors[street.priority] },
            { label: 'Score', value: `${street.impact_score}/120`, color: priorityColors[street.priority] },
            { label: 'Familias', value: `${street.num_viviendas} fam.`, color: 'var(--gray-200)' },
          ].map(item => (
            <div key={item.label} style={{ background: 'var(--surface-card2)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 10, color: 'var(--gray-500)', marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Descripción */}
        {street.description && (
          <div style={{ background: 'var(--surface-card2)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>Descripción ciudadana</p>
            <p style={{ fontSize: 13, color: 'var(--gray-200)', lineHeight: 1.5 }}>{street.description}</p>
          </div>
        )}

        {/* Notas existentes */}
        {street.admin_notes && (
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', marginBottom: 6 }}>Notas registradas</p>
            <p style={{ fontSize: 12, color: 'var(--gray-200)', whiteSpace: 'pre-wrap' }}>{street.admin_notes}</p>
          </div>
        )}

        {/* Estado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Estado actual:</span>
          <span className={`badge ${STATUS_CONFIG[street.status]?.cls}`}>{STATUS_CONFIG[street.status]?.label}</span>
          {alreadyVerified && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>✅ Verificado por ti</span>}
        </div>

        <div className="divider" style={{ marginBottom: 16 }} />

        {/* Corroborar */}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-300)', marginBottom: 10 }}>
            <FileCheck size={14} style={{ display: 'inline', marginRight: 6 }} />
            Corroborar este reporte
          </h3>
          <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10 }}>
            Agrega una nota de verificación. Confirma que la calle efectivamente está en mal estado o aporta información adicional.
          </p>
          <textarea className="form-input" rows={3}
            placeholder="Ej: Confirmo el estado de esta calle, hay 15 familias que se ven afectadas en temporada de lluvias..."
            value={nota} onChange={e => setNota(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'inherit', marginBottom: 10 }} />
          {saved && (
            <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
              ✅ Nota registrada correctamente
            </div>
          )}
          <button className="btn btn-primary" onClick={handleCorroborar}
            disabled={saving || !nota.trim()}
            style={{ fontWeight: 700 }}>
            {saving ? 'Guardando...' : <><FileCheck size={15} /> Corroborar y guardar nota</>}
          </button>
        </div>
      </div>
    </div>
  )
}
