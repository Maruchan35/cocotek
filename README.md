# 🏛️ PriorizaZihua

> Sistema web para registrar, georreferenciar y priorizar automáticamente la pavimentación de calles y andadores del Ayuntamiento de Zihuatanejo de Azueta.

---

## 🚀 Demo

| Vista | URL |
|---|---|
| Formulario ciudadano | `http://localhost:5173/report` |
| Login administrador | `http://localhost:5173/login` |
| Dashboard | `http://localhost:5173/dashboard` |

**Credenciales demo:**
- Email: `admin@zihuatanejo.gob.mx`
- Password: `Zihua2025!`

---

## 🧱 Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TypeScript |
| Estilos | CSS Vanilla (sistema de diseño propio) |
| Mapas | Leaflet.js + OpenStreetMap (gratuito) |
| Base de datos | Supabase (PostgreSQL) |
| Almacenamiento fotos | Supabase Storage |
| Autenticación | Supabase Auth |
| Excel export | SheetJS (xlsx) |
| Gráficas | Chart.js |

---

## ⚙️ Instalación local

### 1. Clona el repositorio

```bash
git clone <URL-del-repo>
cd priorizazihua
```

### 2. Instala dependencias

```bash
npm install
```

### 3. Configura las variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://jsywhjgjdhgrdciymhil.supabase.co
VITE_SUPABASE_ANON_KEY=<pide la clave al líder del equipo>
```

> ⚠️ **NUNCA subas `.env.local` al repositorio.** Ya está en `.gitignore`.

### 4. Configura la base de datos en Supabase

1. Ve a [Supabase SQL Editor](https://supabase.com/dashboard/project/jsywhjgjdhgrdciymhil/sql/new)
2. Copia y ejecuta el archivo `supabase/schema.sql`
3. Crea el bucket `street-photos` como público en Supabase Storage

### 5. Corre el servidor de desarrollo

```bash
npm run dev
```

Abre: **http://localhost:5173**

---

## 📁 Estructura del Proyecto

```
priorizazihua/
├── src/
│   ├── lib/
│   │   ├── supabase.ts          # Cliente Supabase
│   │   ├── priorityEngine.ts    # 🧮 Algoritmo de priorización
│   │   ├── storage.ts           # Upload fotos
│   │   ├── auth.ts              # Login/logout
│   │   └── excelExport.ts       # 📊 Exportar a .xlsx
│   │
│   ├── pages/
│   │   ├── PublicForm.tsx       # Formulario 5 pasos (Presidente Colonia)
│   │   ├── Login.tsx            # Login administrador
│   │   └── Dashboard.tsx        # Panel de control completo
│   │
│   ├── components/
│   │   ├── MapView.tsx          # Mapa Leaflet (formulario + dashboard)
│   │   └── PhotoUpload.tsx      # Drag & drop de fotos
│   │
│   ├── types/index.ts           # Interfaces TypeScript
│   └── index.css                # Sistema de diseño (tokens, utilidades)
│
├── supabase/
│   └── schema.sql               # Script SQL completo + datos de muestra
│
├── .env.local                   # 🔑 NO subir al repo
└── .gitignore
```

---

## 🧮 Algoritmo de Priorización

El score de impacto (0–120 puntos) se calcula así:

| Variable | Puntos máx |
|---|---|
| Tipo de vía (Primaria) | 20 |
| Tipo de tráfico (Pesado) | 15 |
| Viviendas beneficiadas (≥300) | 20 |
| Escuela cercana | 15 |
| Hospital / Centro de Salud | 15 |
| Transporte Público | 10 |
| Mercado cercano | 5 |
| Riesgo lluvias (×4 pts) | 4–20 |
| Longitud > 500m (bonus) | 5 |
| **TOTAL** | **120** |

| Score | Prioridad | Color |
|---|---|---|
| 91–120 | 🔴 MUY ALTA | Rojo |
| 61–90 | 🟠 ALTA | Naranja |
| 31–60 | 🟡 MEDIA | Amarillo |
| 0–30 | 🟢 BAJA | Verde |

---

## 👥 Equipo

- **Hackathon:** Zihuatanejo de Azueta 2025
- **Cliente:** Ayuntamiento de Zihuatanejo — Dirección de Obras Públicas

---

## 📄 Licencia

Proyecto desarrollado para el Ayuntamiento de Zihuatanejo de Azueta.
