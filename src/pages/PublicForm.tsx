import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { calculatePriority } from '../lib/priorityEngine'
import { uploadMultiplePhotos } from '../lib/storage'
import { FormMap } from '../components/MapView'
import PhotoUpload from '../components/PhotoUpload'
import { COLONIAS_ZIHUA, getColoniaInfo, estimarPersonas } from '../lib/coloniaData'
import type { StreetFormData } from '../types'
import { MapPin, Home, Building2, ChevronRight, ChevronLeft, Users, House, Search, Ruler, CheckCircle2, GraduationCap, PlusSquare, ShoppingCart, Bus, Send, Camera } from 'lucide-react'
import HoneycombGallery from '../components/HoneycombGallery'

const emptyForm: StreetFormData = {
  zone_type: 'URBANA',
  street_name: '', colonia: '', lat: null, lng: null,
  length_m: 0, via_type: '', traffic_type: '',
  num_viviendas: 0, near_school: false, near_hospital: false,
  near_market: false, near_transport: false,
  rain_risk: 3, description: '',
  reporter_name: '', reporter_email: '', reporter_phone: '', photos: [],
}

export default function PublicForm() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<StreetFormData>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const set = (key: keyof StreetFormData, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }))

  const steps = [
    { label: 'Datos', icon: <Home size={14} /> },
    { label: 'Ubicación', icon: <MapPin size={14} /> },
    { label: 'Vía y Tráfico', icon: <Building2 size={14} /> },
    { label: 'Impacto y Detalles', icon: <Users size={14} /> },
    { label: 'Evidencia', icon: <Camera size={14} /> },
  ]

  const canNext = () => {
    if (step === 1) return form.street_name && form.colonia && form.reporter_name && form.zone_type
    if (step === 2) {
      if (form.lat === null || form.lng === null || form.length_m <= 0) return false;
      if (form.zone_type === 'URBANA') {
        const statusElement = document.querySelector('.animate-fade-in-up p[style*="#f87171"]');
        if (statusElement) return false;
      }
      return true;
    }
    if (step === 3) return !!form.via_type && !!form.traffic_type
    if (step === 4) return form.num_viviendas > 0
    return true
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const { score, priority } = calculatePriority(form)
      const streetId = crypto.randomUUID()
      let photo_urls: string[] = []
      let photoWarning = ''

      if (form.photos.length > 0) {
        console.log('[Form] Intentando subir', form.photos.length, 'fotos...')
        photo_urls = await uploadMultiplePhotos(form.photos, streetId)
        console.log('[Form] URLs obtenidas:', photo_urls)

        if (photo_urls.length === 0) {
          photoWarning = `⚠️ El reporte se guardó correctamente pero no se pudieron subir las ${form.photos.length} foto(s). Verifica que el bucket "street-photos" esté creado en Supabase Storage como público.`
        } else if (photo_urls.length < form.photos.length) {
          photoWarning = `⚠️ Solo se subieron ${photo_urls.length} de ${form.photos.length} fotos.`
        }
      }

      const { error: dbError } = await supabase.from('streets').insert({
        id: streetId,
        street_name: form.street_name,
        colonia: form.colonia,
        lat: form.lat!,
        lng: form.lng!,
        length_m: form.length_m,
        via_type: form.via_type,
        traffic_type: form.traffic_type,
        num_viviendas: form.num_viviendas,
        near_school: form.near_school,
        near_hospital: form.near_hospital,
        near_market: form.near_market,
        near_transport: form.near_transport,
        rain_risk: form.rain_risk,
        description: form.description,
        photo_urls,
        impact_score: score,
        priority,
        reporter_name: form.reporter_name,
        reporter_email: form.reporter_email,
        reporter_phone: form.reporter_phone,
        status: 'PENDIENTE',
      })

      if (dbError) throw dbError
      if (photoWarning) setError(photoWarning)
      else setSubmitted(true)
    } catch (e: any) {
      setError(e.message ?? 'Error al enviar el reporte. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) return <SuccessScreen onNew={() => { setSubmitted(false); setForm(emptyForm); setStep(1) }} />

  return (
    <HoneycombGallery>
      {/* Header */}
      <header className="navbar" style={{ background: 'transparent', borderBottom: 'none', padding: '24px 40px' }}>
        <div className="navbar-brand">
          <div className="navbar-logo" style={{ boxShadow: '0 0 15px rgba(59,130,246,0.5)' }}>🏛️</div>
          <div>
            <div className="navbar-title" style={{ fontSize: 20 }}>PriorizaZihua</div>
            <div className="navbar-subtitle">Ayuntamiento de Zihuatanejo de Azueta</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* Status Bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.05)',
            padding: '6px 16px',
            borderRadius: 'var(--radius-full)',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e',
              boxShadow: '0 0 10px #22c55e',
              animation: 'pulse 1.5s infinite'
            }}></div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
              Actualizaciones en tiempo real activas
            </span>
          </div>

          <a href="/login" className="btn-nav-ghost">Administrador <ChevronRight size={16} /></a>
        </div>
      </header>

      {/* Blue overlay for step 4 and 5 */}
      {step >= 4 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10, 30, 80, 0.4)', zIndex: 10, pointerEvents: 'none', transition: 'opacity 0.5s ease' }} />
      )}

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 80px', position: 'relative', zIndex: 20 }}>
        {/* Title */}
        <div className="text-center mb-8 animate-fade-in-up">
          <h1 className="text-3xl font-extrabold text-white" style={{ marginBottom: 12 }}>
            Visualiza y Reporta: Tu Comunidad en Tiempo Real
          </h1>
          <p className="text-slate-400 text-base">
            Explora las últimas actualizaciones y fotos de tu colonia. Comparte tu información para ayudarnos a priorizar las obras públicas.
          </p>
        </div>

        {/* Form card */}
        <div className="glass-panel animate-fade-in-up" style={{ animationDelay: '0.1s', backdropFilter: 'blur(24px)', backgroundColor: 'rgba(15,23,42,0.4)' }}>
          
          {/* New Stepper */}
          <div style={{ marginBottom: 40 }}>
            <div className="stepper-container">
              <div className="stepper-progress-bg"></div>
              <div className="stepper-progress-fill" style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}></div>
              {steps.map((_s, i) => (
                <div key={i} className={`stepper-step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}>
                  {step > i + 1 ? <CheckCircle2 size={20} color={step === i + 1 ? "white" : "var(--brand-400)"} /> : i + 1}
                </div>
              ))}
            </div>
            <p className="text-center font-semi" style={{ color: 'var(--brand-400)', fontSize: 14 }}>
              Paso {step} de 5 — {steps[step - 1].label}
            </p>
          </div>

          <div className="animate-fade-in" key={step}>
            {step === 1 && <Step1 form={form} set={set} />}
            {step === 2 && <Step2 form={form} set={set} />}
            {step === 3 && <Step3 form={form} set={set} />}
            {step === 4 && <Step4 form={form} set={set} />}
            {step === 5 && <Step5 form={form} set={set} />}
          </div>

          {error && <div className="alert alert-error mt-6">{error}</div>}

          {/* Micro-interaction Success Message */}
          {step === 4 && form.num_viviendas > 0 && (
            <div className="animate-fade-in-up" style={{ 
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              padding: '12px 20px',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              fontWeight: 700,
              textAlign: 'center',
              marginTop: 32,
              marginBottom: -8,
              boxShadow: '0 10px 25px rgba(16, 185, 129, 0.2)'
            }}>
              ✨ ¡Tu reporte beneficiará a {estimarPersonas(form.num_viviendas, getColoniaInfo(form.colonia)).toLocaleString()} personas!
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8" style={{ paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
            {step > 1
              ? <button className="btn-prev-ghost" onClick={() => setStep(s => s - 1)}>
                  <ChevronLeft size={16} /> Anterior
                </button>
              : <div />
            }
            {step < 5
              ? <button className="btn-next-glow" onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
                  Siguiente <ChevronRight size={18} className="action-icon" />
                </button>
              : <button className="btn-submit-premium" onClick={handleSubmit} disabled={loading || !canNext()}>
                  {loading ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Enviando...</> : <>Enviar Reporte <Send size={18} className="send-icon-anim" /></>}
                </button>
            }
          </div>
        </div>
      </div>
    </HoneycombGallery>
  )
}

/* ── STEP 1: Datos básicos ──────────────────────────────────────── */
import { Map, Phone, Mail } from 'lucide-react'

function Step1({ form, set }: { form: StreetFormData; set: Function }) {
  const coloniaInfo = getColoniaInfo(form.colonia)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* SELECCIÓN DE ZONA */}
      <div>
        <label className="form-label mb-3" style={{ display: 'block', fontSize: 16 }}>¿En qué zona se encuentra?</label>
        <div style={{ display: 'flex', gap: 16 }}>
          <div 
            onClick={() => set('zone_type', 'URBANA')}
            className={`select-card ${form.zone_type === 'URBANA' ? 'selected' : ''}`}
            style={{ flex: 1, padding: '16px', textAlign: 'center', cursor: 'pointer', border: form.zone_type === 'URBANA' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', background: form.zone_type === 'URBANA' ? 'rgba(59,130,246,0.1)' : 'transparent' }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>🏙️</div>
            <div style={{ fontWeight: 700, color: 'white' }}>Zona Urbana</div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>Calles registradas en mapa</div>
          </div>
          <div 
            onClick={() => set('zone_type', 'RURAL')}
            className={`select-card ${form.zone_type === 'RURAL' ? 'selected' : ''}`}
            style={{ flex: 1, padding: '16px', textAlign: 'center', cursor: 'pointer', border: form.zone_type === 'RURAL' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', background: form.zone_type === 'RURAL' ? 'rgba(59,130,246,0.1)' : 'transparent' }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>⛰️</div>
            <div style={{ fontWeight: 700, color: 'white' }}>Zona Rural / Nueva</div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>Peticiones de calles nuevas</div>
          </div>
        </div>
      </div>
      
      <div className="floating-group">
        <Map className="floating-icon" size={20} />
        <input 
          id="street_name"
          className="floating-input" 
          placeholder="Ej: Calle Morelos, Andador 5" 
          value={form.street_name}
          onChange={e => set('street_name', e.target.value)} 
        />
        <label htmlFor="street_name" className="floating-label">Nombre de la Calle o Andador *</label>
      </div>

      <div className="floating-group">
        <Building2 className="floating-icon" size={20} />
        <select 
          id="colonia"
          className={`floating-select ${form.colonia ? 'has-value' : ''}`} 
          value={form.colonia} 
          onChange={e => set('colonia', e.target.value)}
        >
          <option value="" disabled hidden></option>
          {COLONIAS_ZIHUA.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
        </select>
        <label htmlFor="colonia" className="floating-label">Colonia *</label>
      </div>

      {/* Tarjeta informativa de la colonia seleccionada */}
      {coloniaInfo && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))',
          border: '1px solid rgba(59,130,246,0.15)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          animation: 'fadeInUp 0.3s ease both',
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
            📊 Datos de {coloniaInfo.nombre}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>
                {coloniaInfo.habitantes.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Habitantes</div>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>
                {coloniaInfo.viviendas.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Viviendas totales</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>
                {coloniaInfo.personasPorLote}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Personas / lote</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ gap: 24 }}>
        <div className="floating-group">
          <Users className="floating-icon" size={20} />
          <input 
            id="reporter_name"
            className="floating-input" 
            placeholder="Presidente de colonia" 
            value={form.reporter_name}
            onChange={e => set('reporter_name', e.target.value)} 
          />
          <label htmlFor="reporter_name" className="floating-label">Tu nombre *</label>
        </div>
        
        <div className="floating-group">
          <Phone className="floating-icon" size={20} />
          <input 
            id="reporter_phone"
            className="floating-input" 
            placeholder="755-555-0000" 
            value={form.reporter_phone}
            onChange={e => set('reporter_phone', e.target.value)} 
          />
          <label htmlFor="reporter_phone" className="floating-label">Teléfono de contacto</label>
        </div>
      </div>

      {/* Campo de correo electrónico */}
      <div className="floating-group">
        <Mail className="floating-icon" size={20} />
        <input 
          id="reporter_email"
          className="floating-input" 
          type="email"
          placeholder="tu@correo.com" 
          value={form.reporter_email}
          onChange={e => set('reporter_email', e.target.value)} 
        />
        <label htmlFor="reporter_email" className="floating-label">Correo electrónico (para notificaciones)</label>
      </div>
    </div>
  )
}

/* ── STEP 2: Ubicación ──────────────────────────────────────────── */
function Step2({ form, set }: { form: StreetFormData; set: Function }) {
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [bbox, setBbox] = useState<[[number, number], [number, number]] | null>(null)
  const [streetGeoJSON, setStreetGeoJSON] = useState<any | null>(null)
  const [hasAutoSearched, setHasAutoSearched] = useState(false)
  const [searchStatus, setSearchStatus] = useState<{type: 'exact'|'colonia'|'error', msg: string} | null>(null)

  // ── VIEWBOX estricto de Zihuatanejo (lon_min, lat_min, lon_max, lat_max) ──
  const ZIHUA_VIEWBOX = '-101.62,17.58,-101.48,17.72'
  const NOM_HEADERS = { 'Accept': 'application/json' }

  // Función auxiliar: buscar la geometría GeoJSON de un osm_id
  const fetchGeoJSON = async (osmType: string, osmId: string | number) => {
    try {
      const letter = osmType === 'way' ? 'W' : osmType === 'relation' ? 'R' : osmType === 'node' ? 'N' : osmType.charAt(0).toUpperCase()
      const res = await fetch(
        `https://nominatim.openstreetmap.org/lookup?osm_ids=${letter}${osmId}&format=json&polygon_geojson=1`,
        { headers: NOM_HEADERS }
      )
      const data = await res.json()
      if (data?.[0]?.geojson) return data[0].geojson
    } catch (err) { console.error('Error fetching GeoJSON:', err) }
    return null
  }

  // ── BÚSQUEDA DIRECTA con Nominatim (restringida a Zihuatanejo) ──
  const performSearch = async (queries: string[], isAuto: boolean) => {
    if (queries.length === 0) return
    setIsSearching(true)

    for (const q of queries) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(q)}` +
          `&format=json&addressdetails=1&polygon_geojson=1&limit=3` +
          `&viewbox=${ZIHUA_VIEWBOX}&bounded=1`
        
        const res = await fetch(url, { headers: NOM_HEADERS })
        const results = await res.json()

        if (!results || results.length === 0) continue

        // Priorizar resultados que sean calles (class=highway)
        const streetResult = results.find((r: any) => r.class === 'highway') || results[0]
        const isStreet = streetResult.class === 'highway'

        const newLat = parseFloat(streetResult.lat)
        const newLng = parseFloat(streetResult.lon)
        set('lat', newLat)
        set('lng', newLng)

        if (isStreet) {
          // Bounding box directo de Nominatim [lat_min, lat_max, lon_min, lon_max]
          if (streetResult.boundingbox) {
            const bb = streetResult.boundingbox.map(Number)
            setBbox([
              [bb[0], bb[2]], // [lat_min, lon_min]
              [bb[1], bb[3]]  // [lat_max, lon_max]
            ])
          } else {
            setBbox(null)
          }

          // Nominatim con polygon_geojson=1 ya devuelve la geometría directa
          if (streetResult.geojson) {
            setStreetGeoJSON(streetResult.geojson)
          } else if (streetResult.osm_type && streetResult.osm_id) {
            // Fallback: buscar geometría por lookup
            const geo = await fetchGeoJSON(streetResult.osm_type, streetResult.osm_id)
            setStreetGeoJSON(geo)
          } else {
            setStreetGeoJSON(null)
          }
        } else {
          setBbox(null)
          setStreetGeoJSON(null)
        }

        if (isAuto) {
          if (isStreet) setSearchStatus({ type: 'exact', msg: `Calle encontrada: ${streetResult.display_name?.split(',')[0] || 'Calle detectada'}` })
          else setSearchStatus({ type: 'colonia', msg: 'Mostrando zona general — coloca el pin sobre la calle' })
        } else {
          if (isStreet) setSearchStatus({ type: 'exact', msg: `✅ ${streetResult.display_name?.split(',')[0]}` })
          else setSearchStatus({ type: 'colonia', msg: 'Resultado encontrado (no es una calle)' })
        }

        setIsSearching(false)
        return
      } catch (err) {
        console.error('Error buscando ubicación:', err)
      }
    }

    setIsSearching(false)
    if (isAuto) setSearchStatus({ type: 'error', msg: 'Calle no encontrada en Zihuatanejo. Coloca el pin manualmente en el mapa.' })
  }

  // ── BÚSQUEDA INVERSA: cuando el usuario hace click en el mapa ──
  const performReverseSearch = async (lat: number, lng: number) => {
    try {
      // zoom=18 = nivel de calle (máxima precisión)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`,
        { headers: NOM_HEADERS }
      )
      const data = await res.json()

      if (!data || data.error) {
        setStreetGeoJSON(null)
        setSearchStatus({ type: 'colonia', msg: 'Pin fijado (zona no mapeada)' })
        return
      }

      const isStreet = data.class === 'highway'

      if (isStreet && data.osm_type && data.osm_id) {
        const geo = await fetchGeoJSON(data.osm_type, data.osm_id)
        if (geo) {
          setStreetGeoJSON(geo)
          const streetName = data.address?.road || data.display_name?.split(',')[0] || 'Calle detectada'
          setSearchStatus({ type: 'exact', msg: `Pin sobre: ${streetName}` })
        } else {
          setStreetGeoJSON(null)
          setSearchStatus({ type: 'exact', msg: `Calle: ${data.address?.road || 'detectada'} (sin geometría)` })
        }
      } else {
        setStreetGeoJSON(null)
        const info = data.address?.road || data.address?.neighbourhood || data.address?.suburb || ''
        setSearchStatus({ type: 'colonia', msg: info ? `Cerca de: ${info} (mueve el pin a la calle)` : 'Pin fijado (fuera de una calle mapeada)' })
      }
    } catch (err) {
      console.error('Error reverse geocoding:', err)
      setStreetGeoJSON(null)
    }
  }

  // ── Búsqueda automática al entrar al Paso 2 ──
  useEffect(() => {
    if (!hasAutoSearched && !form.lat && form.street_name && form.colonia) {
      const queries = [
        `${form.street_name}, ${form.colonia}, Zihuatanejo, Guerrero`,
        `${form.street_name}, Zihuatanejo, Guerrero`,
        `${form.colonia}, Zihuatanejo, Guerrero`,
      ]
      performSearch(queries, true)
      setHasAutoSearched(true)
    }
  }, [form.street_name, form.colonia, form.lat, hasAutoSearched])

  const handleManualSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      performSearch([
        `${searchText}, Zihuatanejo, Guerrero`,
        `${searchText}, Guerrero, Mexico`
      ], false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      
      {/* Estado de Búsqueda (Movido FUERA del mapa para no invadir) */}
      {(searchFocused || searchStatus) && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)', borderRadius: 'var(--radius-md)', padding: '12px 16px',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          animation: 'fadeInUp 0.2s ease', color: 'var(--gray-300)', fontSize: 13
        }}>
          {searchStatus && (
            <div style={{ margin: '0 0 6px 0', color: searchStatus.type === 'exact' ? '#4ade80' : searchStatus.type === 'colonia' ? '#fbbf24' : '#f87171' }}>
              {searchStatus.type === 'exact' ? '✅' : searchStatus.type === 'colonia' ? '⚠️' : '❌'} {searchStatus.msg}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🌍 Centro actual: <strong style={{color:'white'}}>{form.street_name}, {form.colonia}</strong></span>
            <span style={{ color: 'var(--brand-400)', fontSize: 11 }}>💡 Mueve el mapa para ajustar</span>
          </div>
        </div>
      )}

      {/* Mensaje de ayuda para el mapa */}
      <div className="animate-fade-in" style={{
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12
      }}>
        <div style={{ color: '#60a5fa', marginTop: 2 }}>💡</div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--gray-300)', lineHeight: 1.5 }}>
          <strong>¿No encuentras tu calle exacta?</strong> Puedes usar el buscador que está dentro del mapa para encontrarla rápidamente, o arrastrar el mapa manualmente.
        </p>
      </div>

      {/* MAPA Y BUSCADOR */}
      <div style={{ position: 'relative', borderRadius: 'var(--radius-xl)', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
        
        {/* Barra de Búsqueda (Más pequeña y sutil) */}
        <div className="map-search-overlay" style={{ top: 12, left: 12, transform: 'none', width: 'auto', maxWidth: '300px', padding: '6px 12px' }}>
          <Search size={16} color="var(--brand-400)" />
          <input 
            className="map-search-input"
            style={{ fontSize: 13 }}
            placeholder="Buscar otra calle..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={handleManualSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
          />
          {isSearching && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
        </div>

        {/* Mapa */}
        <FormMap lat={form.lat} lng={form.lng} radius={form.length_m} boundingBox={bbox} streetGeoJSON={streetGeoJSON} onSelect={(lat, lng) => { 
          set('lat', lat); 
          set('lng', lng);
          setBbox(null); 
          setStreetGeoJSON(null);
          setSearchStatus(null);
          performReverseSearch(lat, lng);
        }} />
      </div>

      {/* Tarjeta de Verificación (Movida FUERA del mapa, debajo de él) */}
      {form.lat && form.lng && (
        <div className="animate-fade-in-up" style={{
          background: searchStatus?.type === 'exact' || form.zone_type === 'RURAL' ? 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(15,23,42,0.4))' : 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(15,23,42,0.4))',
          border: searchStatus?.type === 'exact' || form.zone_type === 'RURAL' ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {searchStatus?.type === 'exact' || form.zone_type === 'RURAL' ? (
              <CheckCircle2 size={24} color="#4ade80" />
            ) : (
              <div style={{ fontSize: 24 }}>⚠️</div>
            )}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 2 }}>
                {searchStatus?.type === 'exact' || form.zone_type === 'RURAL' ? 'Ubicación Detectada' : 'Ubicación Inválida'}
              </p>
              <p style={{ fontSize: 15, fontWeight: 800, color: 'white' }}>
                📍 {form.street_name || 'Calle seleccionada'}, Col. {form.colonia || 'Zihuatanejo'}
              </p>
              {form.zone_type === 'URBANA' && searchStatus?.type !== 'exact' && (
                <p style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>
                  En Zona Urbana debes poner el pin exactamente sobre una calle registrada (línea verde). Si es una calle nueva, regresa al Paso 1 y elige Zona Rural.
                </p>
              )}
            </div>
          </div>
          <button className="btn-text" style={{ fontSize: 12, color: 'var(--brand-400)', textDecoration: 'underline' }} onClick={() => { set('lat', null); set('lng', null) }}>
            Quitar pin
          </button>
        </div>
      )}

      {/* Bloquear avance si es urbana y no está en calle exacta */}
      {form.lat && form.lng && form.zone_type === 'URBANA' && searchStatus?.type !== 'exact' && (
        <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontSize: 13, borderRadius: 8, textAlign: 'center', border: '1px solid rgba(239,68,68,0.2)' }}>
          No puedes continuar hasta corregir la ubicación.
        </div>
      )}

      {/* INPUT LONGITUD */}
      <div className="floating-group">
        <Ruler className="floating-icon" size={20} />
        <input 
          id="length_m"
          className="floating-input"
          type="number" 
          min="1"
          placeholder="Ej: 250"
          value={form.length_m || ''}
          onChange={e => set('length_m', parseInt(e.target.value) || 0)} 
        />
        <label htmlFor="length_m" className="floating-label">Longitud aproximada a pavimentar (metros) *</label>
        
        {/* Confirmación animada si ingresó longitud */}
        {form.length_m > 0 && (
          <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}>
            <span className="confirmed-meters">
              <CheckCircle2 size={14} /> Metros confirmados
            </span>
          </div>
        )}
      </div>
      
    </div>
  )
}

/* ── COMPONENTE TARJETA DE SELECCIÓN ───────────────────────────── */
function SelectCard({ selected, title, desc, icon, onClick, fakeStats }: { selected: boolean, title: string, desc: string, icon: React.ReactNode, onClick: () => void, fakeStats: string }) {
  return (
    <div className={`select-card ${selected ? 'selected' : ''}`} onClick={onClick}>
      {selected && <div className="glint"></div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ 
            width: 56, height: 56, borderRadius: '50%', 
            background: selected ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${selected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28
          }}>
            {icon}
          </div>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'white', marginBottom: 4 }}>{title}</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>{desc}</p>
          </div>
        </div>
        <div style={{ 
          width: 26, height: 26, borderRadius: '50%', 
          border: `2px solid ${selected ? '#60a5fa' : 'rgba(255,255,255,0.2)'}`,
          background: selected ? '#3b82f6' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {selected && <CheckCircle2 size={16} color="white" className="micro-anim-bounce" />}
        </div>
      </div>
      {/* Contexto animado */}
      {selected && (
        <div style={{ 
          marginTop: 16, padding: '10px 14px', background: 'rgba(0,0,0,0.3)', 
          borderRadius: 'var(--radius-md)', fontSize: 12, color: '#93c5fd', 
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'fadeInUp 0.3s ease'
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', animation: 'pulse 1.5s infinite' }}></span>
          {fakeStats}
        </div>
      )}
    </div>
  )
}

/* ── STEP 3: Tipo de vía y Tráfico ──────────────────────────────── */
function Step3({ form, set }: { form: StreetFormData; set: Function }) {
  const vias = [
    { value: 'andador', label: 'Andador', desc: 'Solo peatones, acceso a viviendas', icon: <span className="micro-anim-walk">🚶</span>, stat: 'Vía reportada 12 veces hoy en esta zona.' },
    { value: 'secundaria', label: 'Calle Secundaria', desc: 'Tráfico local del vecindario', icon: <span className="micro-anim-drive">🚗</span>, stat: 'Tráfico vecinal verificado hace 5 mins.' },
    { value: 'primaria', label: 'Arteria Principal', desc: 'Conecta colonias o zonas importantes', icon: <span className="micro-anim-drive">🚌</span>, stat: 'Vía de alta prioridad marcada por el sistema.' },
  ]

  const traffics = [
    { value: 'peatonal', label: 'Peatonal', desc: 'Principalmente a pie', icon: <span className="micro-anim-walk">🚶</span>, stat: 'Alta afluencia peatonal detectada.' },
    { value: 'ligero', label: 'Ligero', desc: 'Autos y motocicletas', icon: <span className="micro-anim-drive">🚗</span>, stat: 'Flujo vehicular moderado reportado hoy.' },
    { value: 'pesado', label: 'Pesado', desc: 'Camiones, autobuses, carga', icon: <span className="micro-anim-drive">🚛</span>, stat: 'Tránsito pesado registrado (Alerta de desgaste).' },
  ]

  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <label className="form-label mb-4" style={{ display: 'block', fontSize: 16 }}>1. ¿Qué tipo de vía es? *</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {vias.map(v => (
            <SelectCard 
              key={v.value}
              selected={form.via_type === v.value}
              title={v.label}
              desc={v.desc}
              icon={v.icon}
              onClick={() => set('via_type', v.value)}
              fakeStats={v.stat}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="form-label mb-4" style={{ display: 'block', fontSize: 16 }}>2. ¿Qué tipo de tráfico tiene? *</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {traffics.map(t => (
            <SelectCard 
              key={t.value}
              selected={form.traffic_type === t.value}
              title={t.label}
              desc={t.desc}
              icon={t.icon}
              onClick={() => set('traffic_type', t.value)}
              fakeStats={t.stat}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── STEP 4: Impacto y Detalles ─────────────────────────────────── */
function Step4({ form, set }: { form: StreetFormData; set: Function }) {
  const coloniaInfo = getColoniaInfo(form.colonia)
  const personasEstimadas = form.num_viviendas > 0 ? estimarPersonas(form.num_viviendas, coloniaInfo) : 0

  // Animated Counter Logic
  const [displayViviendas, setDisplayViviendas] = useState(0)
  const [displayPersonas, setDisplayPersonas] = useState(0)

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 800; // 0.8 seconds
    
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      setDisplayViviendas(Math.floor(progress * form.num_viviendas));
      setDisplayPersonas(Math.floor(progress * personasEstimadas));
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    
    window.requestAnimationFrame(step);
  }, [form.num_viviendas, personasEstimadas]);

  const infraOptions = [
    { key: 'near_school',   label: 'Escuela',                icon: <GraduationCap size={24} /> },
    { key: 'near_hospital', label: 'Centro de Salud',        icon: <PlusSquare size={24} /> },
    { key: 'near_market',   label: 'Mercado Local',          icon: <ShoppingCart size={24} /> },
    { key: 'near_transport',label: 'Transporte Público',     icon: <Bus size={24} /> },
  ]
  const riskLabels = ['', 'Bajo', 'Moderado', 'Medio', 'Alto', 'Muy Alto']
  const riskColors = ['', '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444']

  const toggleInfra = (e: React.MouseEvent, key: string) => {
    e.preventDefault()
    set(key as keyof StreetFormData, !form[key as keyof StreetFormData])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }} className="animate-fade-in-up">
      
      {/* ── 1. Cálculo de Impacto ── */}
      <div>
        <label className="form-label" style={{ display: 'block', marginBottom: 12, fontSize: 16 }}>
          Cálculo de Impacto Social *
        </label>
        <input className="form-input" style={{ fontSize: 18, padding: '16px 20px', borderRadius: 'var(--radius-lg)' }} type="number" min="1" placeholder="¿Cuántas viviendas hay en la calle? Ej: 75" value={form.num_viviendas || ''} onChange={e => set('num_viviendas', parseInt(e.target.value) || 0)} />
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, opacity: form.num_viviendas > 0 ? 1 : 0.4, transition: 'all 0.4s ease' }}>
          <div className={`impact-card ${form.num_viviendas > 0 ? 'active' : ''}`}>
            <House size={32} color="#4ade80" className="impact-icon-glow-green" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 40, fontWeight: 900, color: '#4ade80', lineHeight: 1, fontFamily: 'monospace' }}>
              {displayViviendas > 0 ? displayViviendas.toLocaleString() : '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-300)', marginTop: 8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Viviendas</div>
          </div>
          <div className={`impact-card ${form.num_viviendas > 0 ? 'active' : ''}`}>
            <Users size={32} color="#60a5fa" className="impact-icon-glow" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 40, fontWeight: 900, color: '#60a5fa', lineHeight: 1, fontFamily: 'monospace' }}>
              {displayPersonas > 0 ? displayPersonas.toLocaleString() : '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-300)', marginTop: 8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Personas</div>
          </div>
        </div>
      </div>

      {/* ── 2. Infraestructura Cercana (Smart Chips) ── */}
      <div>
        <label className="form-label mb-3" style={{ display: 'block', fontSize: 16 }}>Infraestructura Cercana</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {infraOptions.map(opt => {
            const isChecked = !!form[opt.key as keyof StreetFormData]
            return (
              <div key={opt.key} className={`smart-chip ${isChecked ? 'active' : ''}`} onClick={(e) => toggleInfra(e, opt.key)}>
                <div style={{ color: isChecked ? '#60a5fa' : 'var(--gray-500)', transition: 'color 0.3s' }}>
                  {opt.icon}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: isChecked ? 'white' : 'var(--gray-400)' }}>
                  {opt.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 3. Slider de Riesgo de Lluvias ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <label className="form-label" style={{ fontSize: 16 }}>Riesgo de Lluvias</label>
          <span style={{ 
            color: riskColors[form.rain_risk], 
            fontWeight: 800, 
            fontSize: form.rain_risk > 3 ? 18 : 14,
            textShadow: form.rain_risk > 3 ? `0 0 10px ${riskColors[form.rain_risk]}` : 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            {riskLabels[form.rain_risk]}
          </span>
        </div>
        <input type="range" className="risk-slider-premium" min="1" max="5" step="1" value={form.rain_risk} onChange={e => set('rain_risk', parseInt(e.target.value))} />
      </div>

      {/* ── 4. Campo de Descripción ── */}
      <div style={{ position: 'relative', marginTop: 8 }}>
        <label className="form-label mb-2" style={{ display: 'block', fontSize: 16 }}>Descripción del Problema</label>
        <textarea className="textarea-premium" placeholder="Añade detalles relevantes para tu reporte..." value={form.description} onChange={e => set('description', e.target.value)} />
      </div>

    </div>
  )
}

/* ── STEP 5: Evidencia Fotográfica ──────────────────────────────── */
function Step5({ form, set }: { form: StreetFormData; set: Function }) {
  const { score, priority } = calculatePriority(form)
  const priorityColors: Record<string, string> = {
    MUY_ALTA: '#ef4444', ALTA: '#f97316', MEDIA: '#eab308', BAJA: '#22c55e'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }} className="animate-fade-in-up">
      
      {/* Score Preview Premium */}
      <div style={{
        background: `linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(30, 58, 138, 0.2))`,
        backdropFilter: 'blur(16px)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px',
        border: `1px solid ${priorityColors[priority] || '#3b82f6'}55`,
        boxShadow: `0 0 25px ${priorityColors[priority] || '#3b82f6'}22`,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Ambient Glow */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '120px', height: '120px', background: priorityColors[priority] || '#3b82f6', filter: 'blur(50px)', opacity: 0.25, pointerEvents: 'none' }} />
        
        <div style={{ fontSize: 12, color: 'var(--gray-300)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
          Impacto Estimado
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, zIndex: 1 }}>
          <div style={{ fontSize: 56, fontWeight: 900, color: priorityColors[priority] || '#3b82f6', lineHeight: 1, textShadow: `0 0 20px ${priorityColors[priority] || '#3b82f6'}88`, fontFamily: 'monospace' }}>
            {score}
          </div>
          <div style={{ fontSize: 18, color: 'var(--gray-400)', fontWeight: 700 }}>pts</div>
        </div>
        <div style={{ fontSize: 14, color: 'white', fontWeight: 800, marginTop: 16, background: priorityColors[priority] || '#3b82f6', padding: '6px 24px', borderRadius: '24px', letterSpacing: '0.05em', zIndex: 1, boxShadow: `0 4px 15px ${priorityColors[priority] || '#3b82f6'}66` }}>
          Nivel {priority}
        </div>
      </div>

      {/* ── Evidencia Fotográfica ── */}
      <div>
        <label className="form-label mb-2" style={{ display: 'block', fontSize: 16 }}>Evidencia Fotográfica (opcional)</label>
        <p style={{ color: 'var(--gray-400)', fontSize: 14, marginBottom: 16 }}>
          Añadir fotos nos ayuda significativamente a validar y priorizar tu reporte. 
          Estás a un paso de enviar tu solicitud para mejorar tu comunidad.
        </p>
        <PhotoUpload files={form.photos} onChange={photos => set('photos', photos)} />
      </div>
    </div>
  )
}

/* ── PANTALLA DE ÉXITO ──────────────────────────────────────────── */
function SuccessScreen({ onNew }: { onNew: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a, #1e3a5f, #0f172a)' }}>
      <div className="card text-center animate-fade-in-up" style={{ maxWidth: 440, width: '90%' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 className="text-xl font-bold mb-2">¡Reporte Enviado!</h2>
        <p className="text-muted mb-6">Tu reporte fue registrado y será revisado por el Ayuntamiento de Zihuatanejo. Gracias por contribuir a mejorar tu colonia.</p>
        <button className="btn btn-primary btn-full" onClick={onNew}>Enviar otro reporte</button>
      </div>
    </div>
  )
}
