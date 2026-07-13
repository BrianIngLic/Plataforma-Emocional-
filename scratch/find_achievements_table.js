const fs = require('fs');
const path = require('path');

function searchSqlFiles(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchSqlFiles(fullPath);
    } else if (file.endsWith('.sql')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('user_achievements')) {
        console.log(`Tabla user_achievements mencionada en: ${fullPath}`);
      }
    }
  });
}

searchSqlFiles(path.join(__dirname, '..', 'db'));
