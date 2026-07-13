const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'db', 'migration_skill13_session_evaluations.sql');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('postgres') || line.includes('supabase')) {
    console.log(`Línea ${idx + 1}: ${line}`);
  }
});
