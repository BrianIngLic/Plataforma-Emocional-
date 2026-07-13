const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const content = fs.readFileSync(schemaPath, 'utf8');

const lines = content.split('\n');
console.log('--- Coincidencias de "achievements" en schema.sql ---');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('achievements') && (line.toLowerCase().includes('insert') || line.toLowerCase().includes('create table'))) {
    console.log(`Línea ${idx + 1}: ${line}`);
    // Imprimir las siguientes 10 líneas
    for (let i = 1; i <= 10; i++) {
      if (lines[idx + i]) console.log(`  +${i}: ${lines[idx + i]}`);
    }
  }
});
