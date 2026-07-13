const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const content = fs.readFileSync(schemaPath, 'utf8');

const occurrences = [];
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('create table public.achievements') || line.toLowerCase().includes('create table if not exists public.achievements')) {
    console.log(`Línea de inicio: ${idx + 1}`);
    // Imprimir 25 líneas a partir de ahí
    for (let i = idx; i < idx + 25; i++) {
      occurrences.push(`${i + 1}: ${lines[i]}`);
    }
  }
});
console.log(occurrences.join('\n'));
