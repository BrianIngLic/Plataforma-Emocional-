const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const content = fs.readFileSync(schemaPath, 'utf8');

const lines = content.split('\n');
console.log('--- Buscando funciones o triggers relacionados con streak en schema.sql ---');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('streak') && line.toLowerCase().includes('function')) {
    console.log(`Línea ${idx + 1}: ${line}`);
    for (let i = 1; i <= 60; i++) {
      if (lines[idx + i]) console.log(`  +${i}: ${lines[idx + i]}`);
    }
  }
});
