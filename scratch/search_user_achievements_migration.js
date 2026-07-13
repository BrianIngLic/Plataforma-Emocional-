const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, '..', 'db', 'migration_skill10_gamification.sql');
if (fs.existsSync(migrationPath)) {
  const content = fs.readFileSync(migrationPath, 'utf8');
  const regex = /CREATE\s+TABLE\s+[\s\S]*?user_achievements[\s\S]*?\);/i;
  const match = content.match(regex);
  if (match) {
    console.log('Encontrado en migration_skill10_gamification.sql:\n', match[0]);
  } else {
    // Busquemos cualquier ocurrencia de user_achievements en el archivo
    console.log('No se encontró el CREATE TABLE específico de user_achievements en la migración.');
    const occurrences = [];
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('user_achievements')) {
        occurrences.push(`${idx + 1}: ${line}`);
      }
    });
    console.log('Ocurrencias de "user_achievements":\n', occurrences.join('\n'));
  }
} else {
  console.log('No existe el archivo migration_skill10_gamification.sql');
}
