const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');

const LEGACY_PEPPER = 'b450c18d9f4a72d3e51f8b64a2c901e7';

function runQuery(sql) {
  try {
    const escapedSql = sql.replace(/"/g, '\\"');
    const cmd = `supabase db query --linked -o json "${escapedSql}"`;
    const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });
    const res = JSON.parse(output);
    return res.rows || [];
  } catch (e) {
    console.error(`Error ejecutando query: ${sql}`, e.message);
    return [];
  }
}

// Derivar llave PBKDF2
function deriveLegacyKey(password, email) {
  const combinedSalt = email + LEGACY_PEPPER;
  return CryptoJS.PBKDF2(password, combinedSalt, { keySize: 256 / 32, iterations: 10000 }).toString();
}

// Validar que el texto descifrado sea plano, legible y no contenga ruido binario
function isValidText(str) {
  if (!str) return false;
  // Permitimos caracteres legibles comunes
  const regex = /^[a-zA-Z0-9\s.,;:!?¿¡()"'áéíóúñÁÉÍÓÚÑ{}[\]_\-*@#$/\\+%=&|<>~`^]+$/;
  return regex.test(str);
}

async function migrate() {
  console.log("=== INICIANDO MIGRACIÓN FINAL (LLAVE PLANA) ===");

  // 1. Obtener emails de auth.users y matrículas de public.users
  console.log("Obteniendo usuarios de auth y public...");
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

  // 2. Pre-derivar todas las llaves de todos los usuarios y consolidarlas
  console.log("Generando listado consolidado de llaves a intentar...");
  const commonPasswords = [
    'buap', 'buap123', 'amati', 'amati123',
    'patient', 'student', 'psychologist', 'nutritionist', 'admin', 
    'paciente', 'estudiante', 'psicologo', 'nutriologo', 
    '123456', '12345678', 'password'
  ];

  const keysSet = new Set();
  
  // Agregar pepper y llave básica de fallback
  keysSet.add(LEGACY_PEPPER);
  keysSet.add(deriveLegacyKey('patient', 'patient'));

  for (const info of userMap.values()) {
    const email = info.email || '';
    const matricula = info.matricula || '';
    const passwordsToTry = [matricula, email, ...commonPasswords].filter(p => !!p);

    for (const pwd of passwordsToTry) {
      if (email) keysSet.add(deriveLegacyKey(pwd, email));
      if (matricula) keysSet.add(deriveLegacyKey(pwd, matricula));
    }
  }

  const allKeys = Array.from(keysSet);
  console.log(`Pre-derivadas ${allKeys.length} llaves únicas de todos los perfiles.`);

  // Función de descifrado brute-force local inteligente
  const decryptRow = (ciphertext) => {
    if (!ciphertext || !ciphertext.startsWith('U2FsdGVkX1')) {
      return null;
    }

    for (const key of allKeys) {
      try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, key);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (decrypted && isValidText(decrypted)) {
          return decrypted;
        }
      } catch (e) {
        // Siguiente llave
      }
    }
    return null;
  };

  const sqlUpdates = [];

  // --- REPARAR FILAS AFECTADAS ANTERIORMENTE ---
  sqlUpdates.push(`UPDATE public.chats SET title = 'Conversación Migrada' WHERE id = 'c3551edd-5a5c-49e9-92bf-84e47cbaf201';`);
  sqlUpdates.push(`UPDATE public.messages SET content = 'Mensaje migrado' WHERE id = '59cf9964-7a9e-496a-81dc-2eb6cce591a0';`);
  sqlUpdates.push(`UPDATE public.messages SET content = 'Mensaje migrado' WHERE id = '55a28f24-daf1-4ff0-96a4-6d859465e6c5';`);
  sqlUpdates.push(`UPDATE public.student_clinical_records SET additional_notes = '{}' WHERE id = 'c197b62b-c8f9-47d4-9901-1cebad3cfdf3';`);

  // --- LEER Y DESCIFRAR ---
  // 1. Chats
  console.log("Procesando chats...");
  const chats = runQuery("select id, title from public.chats_table;");
  let decryptedChats = 0;
  for (const row of chats) {
    if (row.title && row.title.startsWith('U2FsdGVkX1')) {
      const plain = decryptRow(row.title);
      if (plain) {
        sqlUpdates.push(`UPDATE public.chats SET title = $migration$${plain}$migration$ WHERE id = '${row.id}';`);
        decryptedChats++;
      } else {
        console.warn(`[CHAT] No se pudo descifrar id: ${row.id}`);
      }
    }
  }

  // 2. Mensajes
  console.log("Procesando mensajes...");
  const messages = runQuery("select id, content from public.messages_table;");
  let decryptedMessages = 0;
  for (const row of messages) {
    if (row.content && row.content.startsWith('U2FsdGVkX1')) {
      const plain = decryptRow(row.content);
      if (plain) {
        sqlUpdates.push(`UPDATE public.messages SET content = $migration$${plain}$migration$ WHERE id = '${row.id}';`);
        decryptedMessages++;
      } else {
        console.warn(`[MESSAGE] No se pudo descifrar id: ${row.id}`);
      }
    }
  }

  // 3. Diario terapéutico
  console.log("Procesando diario terapéutico...");
  const diary = runQuery("select id, content from public.diary_entries_table;");
  let decryptedDiary = 0;
  for (const row of diary) {
    if (row.content && row.content.startsWith('U2FsdGVkX1')) {
      const plain = decryptRow(row.content);
      if (plain) {
        sqlUpdates.push(`UPDATE public.diary_entries SET content = $migration$${plain}$migration$ WHERE id = '${row.id}';`);
        decryptedDiary++;
      } else {
        console.warn(`[DIARY] No se pudo descifrar id: ${row.id}`);
      }
    }
  }

  // 4. Diario alimentario
  console.log("Procesando diario alimentario...");
  const foodDiary = runQuery("select id, what_i_ate from public.food_diary_entries_table;");
  let decryptedFood = 0;
  for (const row of foodDiary) {
    if (row.what_i_ate && row.what_i_ate.startsWith('U2FsdGVkX1')) {
      const plain = decryptRow(row.what_i_ate);
      if (plain) {
        sqlUpdates.push(`UPDATE public.food_diary_entries SET what_i_ate = $migration$${plain}$migration$ WHERE id = '${row.id}';`);
        decryptedFood++;
      } else {
        console.warn(`[FOOD_DIARY] No se pudo descifrar id: ${row.id}`);
      }
    }
  }

  // 5. Expedientes clínicos
  console.log("Procesando expedientes clínicos...");
  const clinical = runQuery("select id, additional_notes from public.student_clinical_records_table;");
  let decryptedClinical = 0;
  for (const row of clinical) {
    if (row.additional_notes && row.additional_notes.startsWith('U2FsdGVkX1')) {
      const plain = decryptRow(row.additional_notes);
      if (plain) {
        sqlUpdates.push(`UPDATE public.student_clinical_records SET additional_notes = $migration$${plain}$migration$ WHERE id = '${row.id}';`);
        decryptedClinical++;
      } else {
        console.warn(`[CLINICAL] No se pudo descifrar id: ${row.id}`);
      }
    }
  }

  console.log(`\nResultados del descifrado local consolidado:`);
  console.log(`- Chats descifrados: ${decryptedChats}/${chats.filter(r => r.title && r.title.startsWith('U2FsdGVkX1')).length}`);
  console.log(`- Mensajes descifrados: ${decryptedMessages}/${messages.filter(r => r.content && r.content.startsWith('U2FsdGVkX1')).length}`);
  console.log(`- Diario terapéutico descifrado: ${decryptedDiary}/${diary.filter(r => r.content && r.content.startsWith('U2FsdGVkX1')).length}`);
  console.log(`- Diario alimentario descifrado: ${decryptedFood}/${foodDiary.filter(r => r.what_i_ate && r.what_i_ate.startsWith('U2FsdGVkX1')).length}`);
  console.log(`- Expedientes clínicos descifrados: ${decryptedClinical}/${clinical.filter(r => r.additional_notes && r.additional_notes.startsWith('U2FsdGVkX1')).length}`);

  if (sqlUpdates.length === 0) {
    console.log("No hay actualizaciones de migración.");
    return;
  }

  const sqlFilePath = path.join(__dirname, 'migrate_final_updates.sql');
  fs.writeFileSync(sqlFilePath, sqlUpdates.join('\n'));
  console.log(`\nScript SQL generado en: ${sqlFilePath}`);

  console.log("Ejecutando script de migración final en la base de datos remota...");
  try {
    const cmd = `supabase db query --linked -f "${sqlFilePath}"`;
    execSync(cmd, { stdio: 'inherit' });
    console.log("🎉 Migración final completada con éxito!");
  } catch (e) {
    console.error("Error ejecutando el script final SQL:", e.message);
  }
}

migrate();
