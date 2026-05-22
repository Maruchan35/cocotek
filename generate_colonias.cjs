const fs = require('fs');
const path = require('path');

const coloniaDataPath = path.join(__dirname, 'src', 'lib', 'coloniaData.ts');
let content = fs.readFileSync(coloniaDataPath, 'utf8');

const match = content.match(/export const COLONIAS_ZIHUA: ColoniaInfo\[\] = \[([\s\S]*?)\]/);
if (!match) process.exit(1);

const coloniasStr = match[1];
const lines = coloniasStr.split('\n');
const colonias = [];

for (let line of lines) {
  if (line.trim() === '') continue;
  const nameMatch = line.match(/nombre:\s*'([^']+)'/);
  const habMatch = line.match(/habitantes:\s*(\d+)/);
  const vivMatch = line.match(/viviendas:\s*(\d+)/);
  const pplMatch = line.match(/personasPorLote:\s*([\d.]+)/);

  if (nameMatch) {
    colonias.push({
      name: nameMatch[1],
      habitantes: parseInt(habMatch[1]),
      viviendas: parseInt(vivMatch[1]),
      personas_por_lote: parseFloat(pplMatch[1])
    });
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function geocode(name) {
  const query = encodeURIComponent(`${name}, Zihuatanejo, Guerrero, Mexico`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'CocotekGeocodingScript/2.0 (santy@example.com)'
      }
    });
    if (res.status === 200) {
      const data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } else {
      console.log(`HTTP Error: ${res.status}`);
    }
  } catch (e) {
    console.error(`Error fetching ${name}:`, e.message);
  }
  return null;
}

async function run() {
  console.log(`Starting geocoding for ${colonias.length} colonias...`);
  const sqlLines = [];
  
  sqlLines.push(`-- Tabla de Colonias Zihuatanejo`);
  sqlLines.push(`CREATE TABLE IF NOT EXISTS public.colonias (`);
  sqlLines.push(`  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,`);
  sqlLines.push(`  nombre text NOT NULL UNIQUE,`);
  sqlLines.push(`  habitantes integer NOT NULL,`);
  sqlLines.push(`  viviendas integer NOT NULL,`);
  sqlLines.push(`  personas_por_lote numeric NOT NULL,`);
  sqlLines.push(`  lat numeric NOT NULL,`);
  sqlLines.push(`  lng numeric NOT NULL`);
  sqlLines.push(`);`);
  sqlLines.push(``);
  sqlLines.push(`-- Habilitar RLS (opcional si se desea restringir)`);
  sqlLines.push(`ALTER TABLE public.colonias ENABLE ROW LEVEL SECURITY;`);
  sqlLines.push(`CREATE POLICY "Las colonias son publicas" ON public.colonias FOR SELECT USING (true);`);
  sqlLines.push(``);
  sqlLines.push(`-- Insertando datos`);

  for (let i = 0; i < colonias.length; i++) {
    const c = colonias[i];
    console.log(`[${i+1}/${colonias.length}] Geocoding ${c.name}...`);
    
    let coords = await geocode(c.name);
    await sleep(2000); // Strict 2 seconds delay

    if (!coords) {
      coords = await geocode(c.name.replace('Infonavit ', ''));
      await sleep(2000);
    }

    if (!coords) {
      console.log(`  -> No encontrado. Usando centro de Zihuatanejo.`);
      coords = { lat: 17.6410, lng: -101.5553 }; // Zihua center
    } else {
      console.log(`  -> Encontrado: ${coords.lat}, ${coords.lng}`);
    }

    c.lat = coords.lat;
    c.lng = coords.lng;

    const nameSql = c.name.replace(/'/g, "''");
    sqlLines.push(`INSERT INTO public.colonias (nombre, habitantes, viviendas, personas_por_lote, lat, lng) VALUES ('${nameSql}', ${c.habitantes}, ${c.viviendas}, ${c.personas_por_lote}, ${c.lat}, ${c.lng}) ON CONFLICT (nombre) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng;`);
  }

  const sqlPath = path.join(__dirname, '01_crear_colonias.sql');
  fs.writeFileSync(sqlPath, sqlLines.join('\n'));
  console.log(`\nArchivo generado con éxito: ${sqlPath}`);
}

run();
