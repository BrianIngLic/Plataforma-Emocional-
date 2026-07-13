const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const content = fs.readFileSync(schemaPath, 'utf8');

const regex = /CREATE\s+TABLE\s+public\.user_achievements[\s\S]*?\);/i;
const match = content.match(regex);
if (match) {
  console.log('Tabla user_achievements:\n', match[0]);
} else {
  console.log('No se encontró la tabla user_achievements en schema.sql');
}
