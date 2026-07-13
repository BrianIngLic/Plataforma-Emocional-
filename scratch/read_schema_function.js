const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const content = fs.readFileSync(schemaPath, 'utf8');

const lines = content.split('\n');
console.log('--- Buscando función update_user_activity_streak en schema.sql ---');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('update_user_activity_streak')) {
    console.log(`Línea ${idx + 1}: ${line}`);
    // Imprimir las siguientes 80 líneas para ver la función completa
    for (let i = 1; i <= 80; i++) {
      if (lines[idx + i]) console.log(`  +${i}: ${lines[idx + i]}`);
    }
  }
});
