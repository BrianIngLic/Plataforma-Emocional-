const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const content = fs.readFileSync(schemaPath, 'utf8');

const lines = content.split('\n');
console.log('--- Def. de public.chats ---');
lines.forEach((line, idx) => {
  if (line.includes('CREATE TABLE public.chats') || line.includes('chats') && line.includes('CREATE TABLE')) {
    for (let i = 0; i < 20; i++) {
      console.log(lines[idx + i]);
    }
  }
});
