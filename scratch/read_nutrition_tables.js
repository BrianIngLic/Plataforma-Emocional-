const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const content = fs.readFileSync(schemaPath, 'utf8');

const lines = content.split('\n');
console.log('--- Def. de nutrition_logs (Línea 196) ---');
for (let i = 0; i < 15; i++) {
  console.log(lines[195 + i]);
}

console.log('\n--- Def. de food_diary_entries (Línea 272) ---');
for (let i = 0; i < 15; i++) {
  console.log(lines[271 + i]);
}
