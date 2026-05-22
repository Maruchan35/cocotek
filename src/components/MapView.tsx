import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Circle, Rectangle, GeoJSON, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Street } from '../types'
import { priorityColors, priorityLabels } from '../lib/priorityEngine'

// Fix default marker icon in Vite builds
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// ── Marcador degradado dinámico (semáforo + tamaño por viviendas) ──
function obtenerColorSemaforo(priority: string) {
  if (priority === 'BAJA') return 'degradado-verde';
  if (priority === 'MEDIA') return 'degradado-amarillo';
  if (priority === 'ALTA') return 'degradado-naranja';
  return 'degradado-rojo'; // MUY_ALTA
}

function createGradientIcon(priority: string, viviendas: number) {
  const claseSemaforo = obtenerColorSemaforo(priority);
  // El tamaño crece dependiendo de las viviendas (mín 30px, máx 70px)
  const diameter = 30 + Math.min((viviendas || 0) / 3, 40);

  const html = `<div class="marcador-degradado ${claseSemaforo}" style="width:${diameter}px;height:${diameter}px;"></div>`;

  return L.divIcon({
    html,
    className: '',
    iconSize: [diameter, diameter],
    iconAnchor: [diameter / 2, diameter / 2],
    popupAnchor: [0, -diameter / 2],
  })
}

function createAnimatedIcon(color: string) {
  return L.divIcon({
    html: `<div class="animate-bounce-drop" style="
      width:26px;height:26px;
      background:${color};
      border:3px solid rgba(255,255,255,0.95);
      border-radius:50% 50% 50% 0;
      box-shadow:0 10px 20px rgba(0,0,0,0.5), 0 0 15px ${color};
    "></div>`,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -28],
  })
}

// ── Subcomponent to handle map click ─────────────────────────────
function ClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

// ── Subcomponent to control map view ─────────────────────────────
function MapController({ lat, lng, bbox }: { lat: number | null, lng: number | null, bbox?: [[number, number], [number, number]] | null }) {
  const map = useMap()
  
  useEffect(() => {
    if (bbox) {
      map.flyToBounds(bbox, { duration: 1.5, maxZoom: 17 })
    } else if (lat !== null && lng !== null) {
      map.flyTo([lat, lng], 16, { duration: 1.5 })
    }
  }, [lat, lng, bbox, map])
  
  return null
}

// ── Form Map: select a location ──────────────────────────────────
interface FormMapProps {
  lat: number | null
  lng: number | null
  radius?: number
  boundingBox?: [[number, number], [number, number]] | null
  streetGeoJSON?: any | null
  onSelect: (lat: number, lng: number) => void
}

export function FormMap({ lat, lng, radius, boundingBox, streetGeoJSON, onSelect }: FormMapProps) {
  const center: [number, number] = [17.6410, -101.5553]
  return (
    <div className="map-container" style={{ height: 400 }}>
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a>'
          maxZoom={19}
        />
        <ClickHandler onSelect={onSelect} />
        <MapController lat={lat} lng={lng} bbox={boundingBox} />
        {lat !== null && lng !== null && (
          <>
            {/* Dibujar la línea exacta de la calle si existe */}
            {streetGeoJSON && (
              <GeoJSON 
                key={JSON.stringify(streetGeoJSON)}
                data={streetGeoJSON} 
                style={{ color: '#4ade80', weight: 6, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }}
              />
            )}
            
            {/* Rectángulo delimitador general solo si NO hay geometría exacta */}
            {boundingBox && !streetGeoJSON && (
              <Rectangle 
                bounds={boundingBox} 
                pathOptions={{ color: '#22d3ee', fillColor: '#22d3ee', fillOpacity: 0.1, weight: 2, dashArray: '6' }}
              />
            )}
            
            {/* Círculo que delimita el espacio a pavimentar */}
            {radius && radius > 0 && (
              <Circle 
                center={[lat, lng]} 
                radius={radius / 2}
                pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2, dashArray: '4' }} 
              />
            )}
            <Marker position={[lat, lng]} icon={createAnimatedIcon('#3b82f6')}>
            </Marker>
          </>
        )}
      </MapContainer>
    </div>
  )
}

// ── Dashboard Map: all pins (degradados dinámicos) ────────────────
interface DashboardMapProps {
  streets: Street[]
  onSelectStreet?: (street: Street) => void
}

const statusLabels: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En Revisión',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
}

export function DashboardMap({ streets, onSelectStreet }: DashboardMapProps) {
  const center: [number, number] = [17.6410, -101.5553]

  return (
    <div className="map-container" style={{ height: 420 }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>'
          maxZoom={19}
        />
        {streets.map(street => (
          <Marker
            key={street.id}
            position={[street.lat, street.lng]}
            icon={createGradientIcon(street.priority, street.num_viviendas)}
            eventHandlers={{ click: () => onSelectStreet?.(street) }}
          >
            <Tooltip direction="top" offset={[0, -(30 + Math.min((street.num_viviendas || 0) / 3, 40))/2]}>
              <div style={{ maxWidth: 280, whiteSpace: 'normal' }}>
                <b>{street.street_name}</b><br/>{street.colonia}<br/>
                <div style={{ margin: '6px 0', color: '#4a5a54', fontSize: '12.5px', lineHeight: 1.3 }}>
                  {street.description || <i>Sin descripción adicional.</i>}
                </div>
                {/* Miniaturas de fotos dentro del tooltip */}
                {street.photo_urls && street.photo_urls.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, overflowX: 'auto' }}>
                    {street.photo_urls.slice(0, 3).map((url, idx) => (
                      <img key={idx} src={url} alt={`Foto ${idx + 1}`}
                        style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd' }} />
                    ))}
                    {street.photo_urls.length > 3 && (
                      <span style={{ fontSize: 10, color: '#64748b', alignSelf: 'center' }}>+{street.photo_urls.length - 3}</span>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  <span style={{ 
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                    background: `${priorityColors[street.priority]}20`, color: priorityColors[street.priority]
                  }}>
                    ● {priorityLabels[street.priority]} · {street.impact_score}pts
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    🏠 {street.num_viviendas} · {street.length_m}m · {statusLabels[street.status] ?? street.status}
                  </span>
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
