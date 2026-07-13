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
    } else {
      if (file.toLowerCase().includes('achievement')) {
        console.log(`Archivo encontrado: ${fullPath}`);
      }
    }
  });
}

console.log('--- Buscando archivos de logros ---');
searchDir(path.join(__dirname, '..', 'src'));
