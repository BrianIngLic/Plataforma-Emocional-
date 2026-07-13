const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const content = fs.readFileSync(schemaPath, 'utf8');

const regex = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.update_user_activity_streak[\s\S]*?\$\$/i;
const match = content.match(regex);
if (match) {
  console.log('Encontrado en schema.sql:\n', match[0]);
} else {
  console.log('No se encontró la función update_user_activity_streak en schema.sql');
}
