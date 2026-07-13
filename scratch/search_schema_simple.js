const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const content = fs.readFileSync(schemaPath, 'utf8');

const lines = content.split('\n');
console.log('--- Buscando update_user_activity_streak ---');
let found = false;
lines.forEach((line, idx) => {
  if (line.includes('update_user_activity_streak')) {
    found = true;
    console.log(`Línea ${idx + 1}: ${line}`);
    for (let i = -5; i <= 30; i++) {
      if (lines[idx + i]) console.log(`  [${idx + i + 1}]: ${lines[idx + i]}`);
    }
  }
});

if (!found) {
  console.log('No se encontró update_user_activity_streak en schema.sql. Buscando "user_streaks"...');
  lines.forEach((line, idx) => {
    if (line.includes('user_streaks') && line.includes('CREATE')) {
      console.log(`Línea ${idx + 1}: ${line}`);
      for (let i = 1; i <= 30; i++) {
        if (lines[idx + i]) console.log(`  +${i}: ${lines[idx + i]}`);
      }
    }
  });
}
