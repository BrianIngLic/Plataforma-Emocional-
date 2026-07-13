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
      if (content.includes('appointment') || content.includes('appointments') || content.includes('status = \'completed\'') || content.includes('completed')) {
        if (content.includes('Service') || content.includes('Component')) {
          // Filtrar por relevancia
          if (content.includes('save') || content.includes('update') || content.includes('changeStatus') || content.includes('complete') || content.includes('concluir')) {
            console.log(`Posible archivo relevante: ${fullPath}`);
          }
        }
      }
    }
  });
}

console.log('--- Buscando lógica de citas en el código ---');
searchDir(path.join(__dirname, '..', 'src'));
