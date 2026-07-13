const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.gemini') {
        searchDir(fullPath);
      }
    } else if (file.endsWith('.sql')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('update_user_activity_streak')) {
        console.log(`Encontrado en SQL: ${fullPath}`);
      }
    }
  });
}

console.log('--- Buscando update_user_activity_streak en archivos SQL ---');
searchDir(path.join(__dirname, '..'));
