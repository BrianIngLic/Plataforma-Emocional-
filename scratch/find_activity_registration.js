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
    } else if (file.endsWith('.ts') || file.endsWith('.html')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('registerActivity')) {
        console.log(`Llamada encontrada en: ${fullPath}`);
      }
    }
  });
}

console.log('--- Buscando llamadas a registerActivity ---');
searchDir(path.join(__dirname, '..', 'src'));
