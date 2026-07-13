const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const content = fs.readFileSync(schemaPath, 'utf8');

const occurrences = [];
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('user_achievements')) {
    occurrences.push(`${idx + 1}: ${line}`);
  }
});
console.log('Líneas que mencionan "user_achievements" en schema.sql:\n', occurrences.join('\n'));
