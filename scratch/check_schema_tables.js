const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const content = fs.readFileSync(schemaPath, 'utf8');

const lines = content.split('\n');
console.log('--- Buscando tablas de Chat y Nutrición ---');
lines.forEach((line, idx) => {
  if (line.includes('CREATE TABLE') && (line.includes('chat') || line.includes('food') || line.includes('nutrition') || line.includes('diary'))) {
    console.log(`Línea ${idx + 1}: ${line}`);
  }
});
