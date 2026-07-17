import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import CryptoJS from "https://esm.sh/crypto-js@4.2.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LEGACY_PEPPER = 'b450c18d9f4a72d3e51f8b64a2c901e7';

// Derivar llave PBKDF2
function deriveLegacyKey(password: string, email: string): string {
  const combinedSalt = email + LEGACY_PEPPER;
  return CryptoJS.PBKDF2(password, combinedSalt, { keySize: 256 / 32, iterations: 10000 }).toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log("Iniciando carga de usuarios para pre-derivación de llaves...");

    // 1. Obtener todos los usuarios de Auth y sus emails
    const { data: { users: authUsers }, error: authError } = await supabaseClient.auth.admin.listUsers({
      limit: 1000
    });
    if (authError) throw authError;

    // 2. Obtener matrículas del esquema público
    const { data: publicUsers, error: pubError } = await supabaseClient
      .from('users')
      .select('id, matricula');
    if (pubError) throw pubError;

    // Mapear id -> { email, matricula }
    const userMap = new Map();
    for (const u of authUsers) {
      userMap.set(u.id, { email: u.email, matricula: '' });
    }
    for (const u of publicUsers) {
      const existing = userMap.get(u.id) || {};
      userMap.set(u.id, { ...existing, id: u.id, matricula: u.matricula });
    }

    // 3. Pre-derivar llaves una sola vez por usuario para ahorrar ciclos CPU (evitar WORKER_RESOURCE_LIMIT)
    console.log("Pre-derivando llaves E2EE por usuario...");
    const userKeysMap = new Map();
    const commonPasswords = ['patient', 'student', 'psychologist', 'nutritionist', 'admin', 'paciente', 'estudiante', 'psicologo', 'nutriologo', '123456', '12345678', 'password'];

    for (const [userId, info] of userMap.entries()) {
      const keys: string[] = [];
      const email = info.email || '';
      const matricula = info.matricula || '';

      const passwordsToTry = [matricula, email, ...commonPasswords].filter(p => !!p);

      for (const pwd of passwordsToTry) {
        if (email) {
          keys.push(deriveLegacyKey(pwd, email));
        }
        if (matricula) {
          keys.push(deriveLegacyKey(pwd, matricula));
        }
      }

      // Fallbacks generales
      keys.push(deriveLegacyKey('patient', 'patient'));
      keys.push(LEGACY_PEPPER);

      // Guardar conjunto único de llaves para este usuario
      userKeysMap.set(userId, Array.from(new Set(keys)));
    }

    console.log("Pre-derivación completada. Iniciando migración de registros...");

    const stats = {
      chats: 0,
      messages: 0,
      diary_entries: 0,
      food_diary_entries: 0,
      clinical_records: 0
    };

    // Función rápida de descifrado
    const decryptRow = (ciphertext: string, studentId: string) => {
      if (!ciphertext || !ciphertext.startsWith('U2FsdGVkX1')) {
        return ciphertext;
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
          // Probar siguiente clave
        }
      }

      return null;
    };

    // 1. Migrar Chats
    const { data: chats } = await supabaseClient.from('chats_table').select('id, student_id, title');
    if (chats) {
      for (const row of chats) {
        if (row.title && row.title.startsWith('U2FsdGVkX1')) {
          const plain = decryptRow(row.title, row.student_id);
          if (plain) {
            await supabaseClient.from('chats').update({ title: plain }).eq('id', row.id);
            stats.chats++;
          }
        }
      }
    }

    // 2. Migrar Messages (joins con chats_table)
    const { data: messages } = await supabaseClient
      .from('messages_table')
      .select('id, content, chat_id, chats_table(student_id)');
    if (messages) {
      for (const row of messages) {
        if (row.content && row.content.startsWith('U2FsdGVkX1')) {
          const chatsInfo = Array.isArray(row.chats_table) ? row.chats_table[0] : row.chats_table;
          const studentId = chatsInfo?.student_id || '';
          const plain = decryptRow(row.content, studentId);
          if (plain) {
            await supabaseClient.from('messages').update({ content: plain }).eq('id', row.id);
            stats.messages++;
          }
        }
      }
    }

    // 3. Migrar Diary Entries
    const { data: diary } = await supabaseClient.from('diary_entries_table').select('id, student_id, content');
    if (diary) {
      for (const row of diary) {
        if (row.content && row.content.startsWith('U2FsdGVkX1')) {
          const plain = decryptRow(row.content, row.student_id);
          if (plain) {
            await supabaseClient.from('diary_entries').update({ content: plain }).eq('id', row.id);
            stats.diary_entries++;
          }
        }
      }
    }

    // 4. Migrar Food Diary Entries
    const { data: foodDiary } = await supabaseClient.from('food_diary_entries_table').select('id, student_id, what_i_ate');
    if (foodDiary) {
      for (const row of foodDiary) {
        if (row.what_i_ate && row.what_i_ate.startsWith('U2FsdGVkX1')) {
          const plain = decryptRow(row.what_i_ate, row.student_id);
          if (plain) {
            await supabaseClient.from('food_diary_entries').update({ what_i_ate: plain }).eq('id', row.id);
            stats.food_diary_entries++;
          }
        }
      }
    }

    // 5. Migrar Student Clinical Records
    const { data: clinical } = await supabaseClient.from('student_clinical_records_table').select('id, student_id, additional_notes');
    if (clinical) {
      for (const row of clinical) {
        if (row.additional_notes && row.additional_notes.startsWith('U2FsdGVkX1')) {
          const plain = decryptRow(row.additional_notes, row.student_id);
          if (plain) {
            await supabaseClient.from('student_clinical_records').update({ additional_notes: plain }).eq('id', row.id);
            stats.clinical_records++;
          }
        }
      }
    }

    console.log("Migración completada con éxito. Estadísticas:", stats);

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
