const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, '..', 'db');
const files = fs.readdirSync(dbDir);

console.log('--- Buscando definiciones de tablas ---');
files.forEach(file => {
  if (file.endsWith('.sql')) {
    const filePath = path.join(dbDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('CREATE TABLE') && (content.includes('mood_logs') || content.includes('food_entries'))) {
      console.log(`Encontrado en el archivo: "${file}"`);
    }
  }
});
