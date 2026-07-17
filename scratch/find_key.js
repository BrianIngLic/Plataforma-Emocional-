const CryptoJS = require('crypto-js');
const { execSync } = require('child_process');

const LEGACY_PEPPER = 'b450c18d9f4a72d3e51f8b64a2c901e7';
const ciphertext = "U2FsdGVkX19/i3WZ8kj5N8CvQJ+NX1CtSoAbxEkE5Os=";

function deriveLegacyKey(password, email) {
  const combinedSalt = email + LEGACY_PEPPER;
  return CryptoJS.PBKDF2(password, combinedSalt, { keySize: 256 / 32, iterations: 10000 }).toString();
}

function runQuery(sql) {
  try {
    const escapedSql = sql.replace(/"/g, '\\"');
    const cmd = `supabase db query --linked -o json "${escapedSql}"`;
    const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });
    const res = JSON.parse(output);
    return res.rows || [];
  } catch (e) {
    return [];
  }
}

async function find() {
  const authUsers = runQuery("select id, email from auth.users;");
  const publicUsers = runQuery("select id, matricula from public.users;");

  const userMap = new Map();
  for (const u of authUsers) {
    userMap.set(u.id, { email: u.email, matricula: '' });
  }
  for (const u of publicUsers) {
    const existing = userMap.get(u.id) || {};
    userMap.set(u.id, { ...existing, id: u.id, matricula: u.matricula });
  }

  const candidatePasswords = [
    'patient', 'student', 'psychologist', 'nutritionist', 'admin', 
    'paciente', 'estudiante', 'psicologo', 'nutriologo', 
    '123456', '12345678', 'password', 'contraseña', 'admin123',
    'buap', 'buap123', 'amati', 'amati123'
  ];

  const keysToTry = [];

  // 1. Intentar la llave maestra directamente
  keysToTry.push({ name: 'LEGACY_PEPPER', key: LEGACY_PEPPER });

  // 2. Intentar contraseñas comunes directly
  for (const p of candidatePasswords) {
    keysToTry.push({ name: `raw password: ${p}`, key: p });
  }

  // 3. Intentar llaves derivadas para cada usuario
  for (const [userId, info] of userMap.entries()) {
    const email = info.email || '';
    const matricula = info.matricula || '';
    for (const pwd of candidatePasswords) {
      if (email) {
        keysToTry.push({ name: `derived pwd:${pwd} email:${email}`, key: deriveLegacyKey(pwd, email) });
      }
      if (matricula) {
        keysToTry.push({ name: `derived pwd:${pwd} matricula:${matricula}`, key: deriveLegacyKey(pwd, matricula) });
      }
    }
  }

  // 4. Intentar fallback de pruebas del servicio
  keysToTry.push({ name: 'derived patient+patient', key: deriveLegacyKey('patient', 'patient') });

  console.log(`Buscando entre ${keysToTry.length} combinaciones de llaves...`);

  for (const item of keysToTry) {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, item.key);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      // Validar si es texto plano legible
      if (decrypted && /^[a-zA-Z0-9\s.,;:!?¿¡()"'áéíóúñÁÉÍÓÚÑ{}]+$/.test(decrypted)) {
        console.log(`\n🎉 ENCONTRADO!`);
        console.log(`Nombre de la llave: ${item.name}`);
        console.log(`Valor de la llave: ${item.key}`);
        console.log(`Texto descifrado: "${decrypted}"`);
        return;
      }
    } catch (e) {
      // Ignorar
    }
  }

  console.log("\n❌ Ninguna llave pudo descifrar el texto de manera legible.");
}

find();
