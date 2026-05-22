-- ================================================================
-- PriorizaZihua — Esquema de Base de Datos
-- Ejecutar en: Supabase > SQL Editor > New Query
-- ================================================================

-- Tabla principal de reportes de calles
CREATE TABLE IF NOT EXISTS streets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Identidad
  street_name    TEXT NOT NULL,
  colonia        TEXT NOT NULL,

  -- Georreferenciación
  lat            DECIMAL(10,8) NOT NULL,
  lng            DECIMAL(11,8) NOT NULL,
  length_m       INTEGER NOT NULL DEFAULT 0,

  -- Tipo de vía
  via_type       TEXT CHECK (via_type IN ('andador','secundaria','primaria')),
  traffic_type   TEXT CHECK (traffic_type IN ('peatonal','ligero','pesado')),

  -- Impacto social
  num_viviendas  INTEGER NOT NULL DEFAULT 0,
  near_school    BOOLEAN NOT NULL DEFAULT false,
  near_hospital  BOOLEAN NOT NULL DEFAULT false,
  near_market    BOOLEAN NOT NULL DEFAULT false,
  near_transport BOOLEAN NOT NULL DEFAULT false,

  -- Riesgo lluvias (1=bajo, 5=muy alto)
  rain_risk      INTEGER CHECK (rain_risk BETWEEN 1 AND 5) DEFAULT 1,

  -- Descripción ciudadana
  description    TEXT DEFAULT '',

  -- Fotos (URLs de Supabase Storage)
  photo_urls     TEXT[] DEFAULT '{}',

  -- Resultado del algoritmo de priorización
  impact_score   DECIMAL(5,2) DEFAULT 0,
  priority       TEXT CHECK (priority IN ('BAJA','MEDIA','ALTA','MUY_ALTA')) DEFAULT 'BAJA',

  -- Gestión administrativa
  status         TEXT NOT NULL DEFAULT 'PENDIENTE'
                 CHECK (status IN ('PENDIENTE','EN_REVISION','APROBADO','RECHAZADO')),
  admin_notes    TEXT DEFAULT '',

  -- Datos del reportante
  reporter_name  TEXT DEFAULT '',
  reporter_phone TEXT DEFAULT ''
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_streets_priority   ON streets(priority);
CREATE INDEX IF NOT EXISTS idx_streets_colonia    ON streets(colonia);
CREATE INDEX IF NOT EXISTS idx_streets_status     ON streets(status);
CREATE INDEX IF NOT EXISTS idx_streets_score      ON streets(impact_score DESC);

-- ================================================================
-- Row Level Security (RLS)
-- Permite inserción pública (formulario ciudadano)
-- Solo admins autenticados pueden leer/actualizar
-- ================================================================
ALTER TABLE streets ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede insertar (formulario público)
CREATE POLICY "public_insert" ON streets
  FOR INSERT WITH CHECK (true);

-- Cualquiera puede leer (para el dashboard demo)
-- En producción: cambiar a: WITH CHECK (auth.role() = 'authenticated')
CREATE POLICY "public_read" ON streets
  FOR SELECT USING (true);

-- Solo autenticados pueden actualizar (aprobar/rechazar)
CREATE POLICY "auth_update" ON streets
  FOR UPDATE USING (auth.role() = 'authenticated');

-- ================================================================
-- Datos de muestra — Colonias reales de Zihuatanejo
-- ================================================================
INSERT INTO streets (street_name, colonia, lat, lng, length_m, via_type, traffic_type,
  num_viviendas, near_school, near_hospital, near_market, near_transport,
  rain_risk, description, photo_urls, impact_score, priority, status,
  reporter_name, reporter_phone)
VALUES
  ('Calle Morelos', 'Centro', 17.6415, -101.5562, 320, 'primaria', 'pesado',
   280, true, true, true, true, 5,
   'La calle principal del centro está completamente deteriorada, con baches profundos que causan accidentes en temporada de lluvias.',
   '{}', 105, 'MUY_ALTA', 'PENDIENTE', 'Juan García López', '755-555-0101'),

  ('Andador Guadalupe', 'La Madera', 17.6432, -101.5578, 180, 'andador', 'peatonal',
   95, true, false, false, false, 4,
   'El andador que conecta la escuela primaria con la colonia está sin pavimentar, es peligroso para los niños.',
   '{}', 58, 'MEDIA', 'PENDIENTE', 'María Sánchez Reyes', '755-555-0202'),

  ('Calle Emiliano Zapata', 'Benito Juárez', 17.6398, -101.5545, 450, 'secundaria', 'ligero',
   185, false, true, false, true, 4,
   'Acceso principal al Centro de Salud. En lluvias se inunda completamente, impidiendo el acceso de ambulancias.',
   '{}', 80, 'ALTA', 'EN_REVISION', 'Pedro Ramírez Cruz', '755-555-0303'),

  ('Andador 16 de Septiembre', 'El Limón', 17.6388, -101.5580, 220, 'andador', 'peatonal',
   60, false, false, true, false, 3,
   'Barro y piedras dificultan el paso, especialmente para adultos mayores.',
   '{}', 38, 'MEDIA', 'PENDIENTE', 'Rosa Torres Vega', '755-555-0404'),

  ('Boulevard Ixtapa', 'Ixtapa', 17.6680, -101.5730, 680, 'primaria', 'pesado',
   320, false, false, false, true, 2,
   'Arteria principal de la zona turística con tramos sin pavimentar que afectan el turismo.',
   '{}', 72, 'ALTA', 'APROBADO', 'Carlos Mendoza Ávila', '755-555-0505'),

  ('Calle Cuauhtémoc', 'Pantla', 17.6355, -101.5510, 380, 'secundaria', 'ligero',
   220, true, false, false, false, 5,
   'Frente a la escuela secundaria. Las lluvias la vuelven intransitable y los alumnos no pueden llegar.',
   '{}', 85, 'ALTA', 'PENDIENTE', 'Lucía Flores Moreno', '755-555-0606'),

  ('Andador Las Flores', 'Juan Álvarez', 17.6370, -101.5598, 150, 'andador', 'peatonal',
   45, false, false, false, false, 2,
   'Acceso a viviendas en pendiente pronunciada, sin pavimento genera riesgo de caídas.',
   '{}', 24, 'BAJA', 'PENDIENTE', 'Antonio López Ruiz', '755-555-0707'),

  ('Calle Lázaro Cárdenas', 'Lázaro Cárdenas', 17.6422, -101.5532, 510, 'primaria', 'pesado',
   310, true, true, false, true, 4,
   'Calle principal con hospital y escuela. Estado crítico, varias personas han sufrido accidentes.',
   '{}', 115, 'MUY_ALTA', 'PENDIENTE', 'Esperanza Díaz Gutiérrez', '755-555-0808'),

  ('Andador Solidaridad', 'Agua de Correa', 17.6342, -101.5567, 260, 'andador', 'peatonal',
   78, false, false, true, false, 5,
   'Sin pavimento desde hace 15 años. En temporada de lluvias es imposible salir de las casas.',
   '{}', 56, 'MEDIA', 'PENDIENTE', 'Fernando Reyes Castro', '755-555-0909'),

  ('Calle Revolución', 'La Noria', 17.6405, -101.5558, 290, 'secundaria', 'ligero',
   150, false, false, false, true, 3,
   'Ruta de transporte público sin pavimentar. Los autobuses dañan el camino constantemente.',
   '{}', 65, 'ALTA', 'PENDIENTE', 'Graciela Muñoz Peña', '755-555-1010');
