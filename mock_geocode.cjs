const fs = require('fs');
const path = require('path');

const coloniaDataPath = path.join(__dirname, 'src', 'lib', 'coloniaData.ts');
let content = fs.readFileSync(coloniaDataPath, 'utf8');

const match = content.match(/export const COLONIAS_ZIHUA: ColoniaInfo\[\] = \[([\s\S]*?)\]/);
if (!match) process.exit(1);

const coloniasStr = match[1];
const lines = coloniasStr.split('\n');

let newLines = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.trim() === '') continue;
  if (!line.includes('nombre:')) {
    newLines.push(line);
    continue;
  }

  // Zihua center: 17.6410, -101.5553
  // Random offset between -0.01 and 0.01
  const latOffset = (Math.random() - 0.5) * 0.02;
  const lngOffset = (Math.random() - 0.5) * 0.02;
  const lat = (17.6410 + latOffset).toFixed(5);
  const lng = (-101.5553 + lngOffset).toFixed(5);

  const modifiedLine = line.replace(/ \},$/, `, lat: ${lat}, lng: ${lng} },`);
  newLines.push(modifiedLine);
}

const newColoniasStr = newLines.join('\n');
const newContent = content.replace(match[1], '\n' + newColoniasStr + '\n');
const finalContent = newContent.replace('personasPorLote: number', 'personasPorLote: number\n  lat?: number\n  lng?: number');
fs.writeFileSync(coloniaDataPath, finalContent);
console.log("Done mocking geocodes!");
