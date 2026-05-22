import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { COLONIAS_ZIHUA } from '../lib/coloniaData'

// Una colección de IDs de imágenes de Picsum para simular fotos
const PICSUM_IMAGES = [
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
  40, 41, 42, 43, 44, 45, 46, 47, 48, 49
]

interface HexPhoto {
  id: number
  imgUrl: string
  colonia: string
  highlight: boolean
  fading: boolean
  isReal?: boolean
}

export default function HoneycombGallery({ children }: { children: React.ReactNode }) {
  const [hexes, setHexes] = useState<HexPhoto[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<HexPhoto | null>(null)
  const [realPhotos, setRealPhotos] = useState<{url: string, colonia: string}[]>([])

  // Cargar fotos reales de Supabase
  useEffect(() => {
    async function loadRealPhotos() {
      const { data, error } = await supabase
        .from('streets')
        .select('colonia, photo_urls')
        .not('photo_urls', 'is', null)

      if (!error && data) {
        const photos = data.flatMap(s => 
          (s.photo_urls || []).map((url: string) => ({ url, colonia: s.colonia }))
        )
        setRealPhotos(photos)
      }
    }
    loadRealPhotos()
  }, [])

  // Inicializar grid
  useEffect(() => {
    const initial = Array.from({ length: 45 }).map((_, i) => {
      // Si hay fotos reales, usarlas con 50% de probabilidad (o si hay suficientes)
      const useReal = realPhotos.length > 0 && Math.random() > 0.5
      const realP = useReal ? realPhotos[Math.floor(Math.random() * realPhotos.length)] : null

      return {
        id: i,
        imgUrl: realP ? realP.url : `https://picsum.photos/id/${PICSUM_IMAGES[Math.floor(Math.random() * PICSUM_IMAGES.length)]}/400/400`,
        colonia: realP ? realP.colonia : COLONIAS_ZIHUA[Math.floor(Math.random() * COLONIAS_ZIHUA.length)].nombre,
        highlight: Math.random() > 0.85,
        fading: false,
        isReal: !!realP
      }
    })
    setHexes(initial)
  }, [realPhotos.length]) // Recalcular inicial cuando carguen las reales

  // Simular actualizaciones en tiempo real
  useEffect(() => {
    if (hexes.length === 0) return

    const interval = setInterval(() => {
      // Elegir 1 a 3 hexágonos para actualizar
      const numToUpdate = Math.floor(Math.random() * 3) + 1
      
      setHexes(current => {
        const next = [...current]
        
        // Quitar highlights viejos
        next.forEach(h => { if (Math.random() > 0.7) h.highlight = false })

        for (let i = 0; i < numToUpdate; i++) {
          const idx = Math.floor(Math.random() * next.length)
          const useReal = realPhotos.length > 0 && Math.random() > 0.3
          const realP = useReal ? realPhotos[Math.floor(Math.random() * realPhotos.length)] : null
          
          const newUrl = realP ? realP.url : `https://picsum.photos/id/${PICSUM_IMAGES[Math.floor(Math.random() * PICSUM_IMAGES.length)]}/400/400`
          const newColonia = realP ? realP.colonia : COLONIAS_ZIHUA[Math.floor(Math.random() * COLONIAS_ZIHUA.length)].nombre
          
          next[idx] = {
            ...next[idx],
            imgUrl: newUrl,
            colonia: newColonia,
            highlight: true,
            fading: true,
            isReal: !!realP
          }
        }
        return next
      })

      // Quitar clase fading después de 1 segundo
      setTimeout(() => {
        setHexes(current => current.map(h => ({ ...h, fading: false })))
      }, 1000)

    }, 3500) // Cada 3.5 segundos hay actividad nueva

    return () => clearInterval(interval)
  }, [hexes.length])

  return (
    <div className="honeycomb-layout">
      {/* Background Layer */}
      <div className="honeycomb-container">
        <ul className="honeycomb">
          {hexes.map((hex) => (
            <li 
              key={hex.id} 
              className={`hexagon ${hex.highlight ? 'hex-highlight' : ''}`}
              onClick={() => setSelectedPhoto(hex)}
            >
              <div className="hex-content">
                <img 
                  src={hex.imgUrl} 
                  alt={hex.colonia} 
                  className={hex.fading ? 'fading' : ''}
                  onError={(e) => {
                    // Fallback visual si la URL de supabase falla
                    e.currentTarget.src = `https://picsum.photos/id/10/400/400`
                  }}
                />
                <div className="hex-tooltip">{hex.colonia}</div>
              </div>
            </li>
          ))}
        </ul>
        <div className="honeycomb-overlay"></div>
      </div>

      {/* Foreground Layer (Form) */}
      <div className="honeycomb-foreground">
        {children}
      </div>

      {/* Modal / Popup */}
      {selectedPhoto && (
        <div className="hex-modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="hex-modal-content" onClick={e => e.stopPropagation()}>
            <button className="hex-modal-close" onClick={() => setSelectedPhoto(null)}>×</button>
            <img 
              src={selectedPhoto.imgUrl} 
              alt={selectedPhoto.colonia} 
              onError={(e) => { e.currentTarget.src = `https://picsum.photos/id/10/800/500` }}
            />
            <div className="hex-modal-info">
              <div className="hex-modal-tag" style={{
                background: selectedPhoto.isReal ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)',
                color: selectedPhoto.isReal ? '#4ade80' : 'var(--brand-400)',
                border: selectedPhoto.isReal ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(59,130,246,0.3)'
              }}>
                {selectedPhoto.isReal ? '✅ Evidencia Real de Usuario' : '📷 Foto Ilustrativa'}
              </div>
              <h3>{selectedPhoto.colonia}</h3>
              <p>Esta es una imagen representativa del reporte enviado por los vecinos de la zona. Ayuda a documentar las condiciones de la infraestructura vial y la prioridad de intervención.</p>
              <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                <span className="hex-modal-stat">📅 Hace unos minutos</span>
                <span className="hex-modal-stat">👀 12 vistas</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
