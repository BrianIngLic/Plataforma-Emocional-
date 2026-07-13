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
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('postgresql://') || content.includes('postgres://') || content.includes('supabase.co')) {
        if (!fullPath.endsWith('.js') && !fullPath.endsWith('.map') && !fullPath.endsWith('environment.development.ts') && !fullPath.endsWith('environment.ts')) {
          console.log(`Posible credencial en: ${fullPath}`);
        }
      }
    }
  });
}

console.log('--- Buscando conexiones de base de datos ---');
searchDir(path.join(__dirname, '..'));
