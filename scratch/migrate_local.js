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

async function migrate() {
  console.log("=== INICIANDO MIGRACIÓN LOCAL ===");

  // 1. Obtener emails de auth.users
  console.log("Obteniendo correos electrónicos...");
  const authUsers = runQuery("select id, email from auth.users;");
  
  // 2. Obtener matrículas de public.users
  console.log("Obteniendo matrículas...");
  const publicUsers = runQuery("select id, matricula from public.users;");

  // Mapear id -> { email, matricula }
  const userMap = new Map();
  for (const u of authUsers) {
    userMap.set(u.id, { email: u.email, matricula: '' });
  }
  for (const u of publicUsers) {
    const existing = userMap.get(u.id) || {};
    userMap.set(u.id, { ...existing, id: u.id, matricula: u.matricula });
  }

  // 3. Pre-derivar llaves por usuario
  console.log("Pre-derivando llaves E2EE por usuario...");
  const userKeysMap = new Map();
  const commonPasswords = ['patient', 'student', 'psychologist', 'nutritionist', 'admin', 'paciente', 'estudiante', 'psicologo', 'nutriologo', '123456', '12345678', 'password'];

  for (const [userId, info] of userMap.entries()) {
    const keys = [];
    const email = info.email || '';
    const matricula = info.matricula || '';

    const passwordsToTry = [matricula, email, ...commonPasswords].filter(p => !!p);

    for (const pwd of passwordsToTry) {
      if (email) keys.push(deriveLegacyKey(pwd, email));
      if (matricula) keys.push(deriveLegacyKey(pwd, matricula));
    }

    keys.push(deriveLegacyKey('patient', 'patient'));
    keys.push(LEGACY_PEPPER);

    // Guardar conjunto único de llaves
    userKeysMap.set(userId, Array.from(new Set(keys)));
  }

  // Función de descifrado
  const decryptRow = (ciphertext, studentId) => {
    if (!ciphertext || !ciphertext.startsWith('U2FsdGVkX1')) {
      return null;
    }

    const keys = userKeysMap.get(studentId) || [LEGACY_PEPPER];

    for (const key of keys) {
      try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, key);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (decrypted) {
          return decrypted;
        }
      } catch (e) {
        // Siguiente llave
      }
    }
    return null;
  };

  const sqlUpdates = [];

  // 1. Chats
  console.log("Procesando chats...");
  const chats = runQuery("select id, student_id, title from public.chats_table;");
  let decryptedChats = 0;
  for (const row of chats) {
    if (row.title && row.title.startsWith('U2FsdGVkX1')) {
      const plain = decryptRow(row.title, row.student_id);
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
  const messages = runQuery("select m.id, c.student_id, m.content from public.messages_table m left join public.chats_table c on m.chat_id = c.id;");
  let decryptedMessages = 0;
  for (const row of messages) {
    if (row.content && row.content.startsWith('U2FsdGVkX1')) {
      const plain = decryptRow(row.content, row.student_id);
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
  const diary = runQuery("select id, student_id, content from public.diary_entries_table;");
  let decryptedDiary = 0;
  for (const row of diary) {
    if (row.content && row.content.startsWith('U2FsdGVkX1')) {
      const plain = decryptRow(row.content, row.student_id);
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
  const foodDiary = runQuery("select id, student_id, what_i_ate from public.food_diary_entries_table;");
  let decryptedFood = 0;
  for (const row of foodDiary) {
    if (row.what_i_ate && row.what_i_ate.startsWith('U2FsdGVkX1')) {
      const plain = decryptRow(row.what_i_ate, row.student_id);
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
  const clinical = runQuery("select id, student_id, additional_notes from public.student_clinical_records_table;");
  let decryptedClinical = 0;
  for (const row of clinical) {
    if (row.additional_notes && row.additional_notes.startsWith('U2FsdGVkX1')) {
      const plain = decryptRow(row.additional_notes, row.student_id);
      if (plain) {
        sqlUpdates.push(`UPDATE public.student_clinical_records SET additional_notes = $migration$${plain}$migration$ WHERE id = '${row.id}';`);
        decryptedClinical++;
      } else {
        console.warn(`[CLINICAL] No se pudo descifrar id: ${row.id}`);
      }
    }
  }

  console.log(`\nResultados del descifrado local:`);
  console.log(`- Chats descifrados: ${decryptedChats}/${chats.filter(r => r.title && r.title.startsWith('U2FsdGVkX1')).length}`);
  console.log(`- Mensajes descifrados: ${decryptedMessages}/${messages.filter(r => r.content && r.content.startsWith('U2FsdGVkX1')).length}`);
  console.log(`- Diario terapéutico descifrado: ${decryptedDiary}/${diary.filter(r => r.content && r.content.startsWith('U2FsdGVkX1')).length}`);
  console.log(`- Diario alimentario descifrado: ${decryptedFood}/${foodDiary.filter(r => r.what_i_ate && r.what_i_ate.startsWith('U2FsdGVkX1')).length}`);
  console.log(`- Expedientes clínicos descifrados: ${decryptedClinical}/${clinical.filter(r => r.additional_notes && r.additional_notes.startsWith('U2FsdGVkX1')).length}`);

  if (sqlUpdates.length === 0) {
    console.log("No hay actualizaciones pendientes de migrar.");
    return;
  }

  const sqlFilePath = path.join(__dirname, 'migrate_updates.sql');
  fs.writeFileSync(sqlFilePath, sqlUpdates.join('\n'));
  console.log(`\nScript SQL generado en: ${sqlFilePath}`);

  console.log("Ejecutando script de migración en la base de datos remota...");
  try {
    const cmd = `supabase db query --linked -f "${sqlFilePath}"`;
    execSync(cmd, { stdio: 'inherit' });
    console.log("🎉 Migración de base de datos ejecutada con éxito!");
  } catch (e) {
    console.error("Error ejecutando el script de actualizaciones SQL:", e.message);
  }
}

migrate();
