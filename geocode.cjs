const fs = require('fs');
const path = require('path');

const coloniaDataPath = path.join(__dirname, 'src', 'lib', 'coloniaData.ts');
let content = fs.readFileSync(coloniaDataPath, 'utf8');

// Extract the COLONIAS_ZIHUA array using regex
const match = content.match(/export const COLONIAS_ZIHUA: ColoniaInfo\[\] = \[([\s\S]*?)\]/);
if (!match) {
  console.error("Could not find COLONIAS_ZIHUA");
  process.exit(1);
}

const coloniasStr = match[1];
const colonias = [];
const lines = coloniasStr.split('\n');

for (const line of lines) {
  if (line.trim() === '') continue;
  const nameMatch = line.match(/nombre:\s*'([^']+)'/);
  if (nameMatch) {
    colonias.push({
      originalLine: line,
      name: nameMatch[1],
    });
  } else {
    colonias.push({ originalLine: line });
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocode(name) {
  const query = encodeURIComponent(`${name}, Zihuatanejo, Guerrero, Mexico`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'CocotekGeocodingScript/1.0 (santy@example.com)'
      }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error(`Error fetching ${name}:`, e.message);
  }
  return null;
}

async function run() {
  console.log(`Found ${colonias.filter(c => c.name).length} colonias to geocode.`);
  
  let newLines = [];
  for (let i = 0; i < colonias.length; i++) {
    const c = colonias[i];
    if (!c.name) {
      newLines.push(c.originalLine);
      continue;
    }

    console.log(`Geocoding ${i+1}/${colonias.length}: ${c.name}...`);
    let coords = await geocode(c.name);
    
    // If not found, try fallback without "Guerrero" or just the city center
    if (!coords) {
      console.log(`  Not found immediately, trying fallback...`);
      coords = await geocode(c.name.replace('Infonavit ', '')); 
    }

    // Default to Zihuatanejo center if completely not found
    if (!coords) {
      console.log(`  Still not found. Using default center.`);
      coords = { lat: 17.6434, lng: -101.5526 }; // Zihua center
    } else {
      console.log(`  Found: ${coords.lat}, ${coords.lng}`);
    }

    // Append to the line
    const modifiedLine = c.originalLine.replace(/ \},$/, `, lat: ${coords.lat}, lng: ${coords.lng} },`);
    newLines.push(modifiedLine);
    
    await sleep(1100); // Nominatim rate limit
  }

  const newColoniasStr = newLines.join('\n');
  const newContent = content.replace(match[1], '\n' + newColoniasStr + '\n');
  
  // also update interface
  const finalContent = newContent.replace('personasPorLote: number', 'personasPorLote: number\n  lat?: number\n  lng?: number');
  
  fs.writeFileSync(coloniaDataPath, finalContent);
  console.log("Done updating coloniaData.ts!");
}

run();
