const fs = require('fs');
const path = require('path');

const coloniaDataPath = path.join(__dirname, 'src', 'lib', 'coloniaData.ts');
let content = fs.readFileSync(coloniaDataPath, 'utf8');

const match = content.match(/export const COLONIAS_ZIHUA: ColoniaInfo\[\] = \[([\s\S]*?)\]/);
if (!match) process.exit(1);

const coloniasStr = match[1];
const lines = coloniasStr.split('\n');

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
sqlLines.push(`-- Habilitar RLS (opcional)`);
sqlLines.push(`ALTER TABLE public.colonias ENABLE ROW LEVEL SECURITY;`);
sqlLines.push(`CREATE POLICY "Las colonias son publicas" ON public.colonias FOR SELECT USING (true);`);
sqlLines.push(``);
sqlLines.push(`-- Insertando datos`);

for (let line of lines) {
  if (line.trim() === '') continue;
  
  const nameMatch = line.match(/nombre:\s*'([^']+)'/);
  const habMatch = line.match(/habitantes:\s*(\d+)/);
  const vivMatch = line.match(/viviendas:\s*(\d+)/);
  const pplMatch = line.match(/personasPorLote:\s*([\d.]+)/);
  const latMatch = line.match(/lat:\s*([-\d.]+)/);
  const lngMatch = line.match(/lng:\s*([-\d.]+)/);

  if (nameMatch) {
    const nombre = nameMatch[1].replace(/'/g, "''");
    const habitantes = parseInt(habMatch[1]);
    const viviendas = parseInt(vivMatch[1]);
    const personas_por_lote = parseFloat(pplMatch[1]);
    const lat = latMatch ? parseFloat(latMatch[1]) : 17.6410;
    const lng = lngMatch ? parseFloat(lngMatch[1]) : -101.5553;

    sqlLines.push(`INSERT INTO public.colonias (nombre, habitantes, viviendas, personas_por_lote, lat, lng) VALUES ('${nombre}', ${habitantes}, ${viviendas}, ${personas_por_lote}, ${lat}, ${lng}) ON CONFLICT (nombre) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, habitantes = EXCLUDED.habitantes, viviendas = EXCLUDED.viviendas, personas_por_lote = EXCLUDED.personas_por_lote;`);
  }
}

const sqlPath = path.join(__dirname, '01_crear_colonias.sql');
fs.writeFileSync(sqlPath, sqlLines.join('\n'));
console.log(`Archivo generado con éxito: ${sqlPath}`);
