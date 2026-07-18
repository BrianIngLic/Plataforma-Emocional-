const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Cargar variables de entorno del archivo .env local
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.APP_URL || 'http://localhost:4200';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Las variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas en el archivo .env');
  process.exit(1);
}

// Inicializar cliente Supabase con privilegios admin (service_role)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    experimental: {
      passkey: true
    }
  }
});

// Función para registrar auditoría
async function logAudit(email, action, performedBy, details = {}) {
  try {
    const { error } = await supabase
      .from('admin_audit_log')
      .insert({
        admin_email: email,
        action,
        performed_by: performedBy,
        details,
        ip_address: 'localhost-cli'
      });
    if (error) {
      console.warn(`[Advertencia] No se pudo escribir en log de auditoría: ${error.message}`);
    }
  } catch (e) {
    console.warn(`[Advertencia] Excepción escribiendo auditoría: ${e.message}`);
  }
}

// Obtener usuario de la tabla public.users y auth.users
async function getAdminUser(email) {
  const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
  if (authError || !authUser) {
    throw new Error(`Error listando usuarios: ${authError?.message}`);
  }
  const u = authUser.users.find(user => user.email?.toLowerCase() === email.toLowerCase());
  if (!u) return null;

  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('*')
    .eq('id', u.id)
    .single();

  return { auth: u, db: dbUser || null };
}

// Procesar comandos de consola
const args = process.argv.slice(2);
const command = args[0];
const targetEmail = args[1];
const extraArg = args[2];

const operator = 'TI-Admin-CLI';

async function run() {
  if (!command) {
    printHelp();
    return;
  }

  try {
    switch (command) {
      case 'create':
        if (!targetEmail) throw new Error('Uso: node admin-manager.js create <email>');
        await handleCreate(targetEmail);
        break;

      case 'revoke':
        if (!targetEmail) throw new Error('Uso: node admin-manager.js revoke <email>');
        await handleRevoke(targetEmail);
        break;

      case 'reenroll':
        if (!targetEmail) throw new Error('Uso: node admin-manager.js reenroll <email>');
        await handleReenroll(targetEmail);
        break;

      case 'disable':
        if (!targetEmail) throw new Error('Uso: node admin-manager.js disable <email>');
        await handleDisable(targetEmail);
        break;

      case 'enable':
        if (!targetEmail) throw new Error('Uso: node admin-manager.js enable <email>');
        await handleEnable(targetEmail);
        break;

      case 'update-email':
        if (!targetEmail || !extraArg) throw new Error('Uso: node admin-manager.js update-email <email-viejo> <email-nuevo>');
        await handleUpdateEmail(targetEmail, extraArg);
        break;

      case 'status':
        if (!targetEmail) throw new Error('Uso: node admin-manager.js status <email>');
        await handleStatus(targetEmail);
        break;

      case 'list':
        await handleList();
        break;

      default:
        console.error(`Comando desconocido: ${command}`);
        printHelp();
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
🛠️  amati - Gestor de Administradores (TI CLI)
Uso: node admin-manager.js <comando> <email> [opciones]

Comandos disponibles:
  create       <email>                → Crear admin, insertar fila en DB y enviar Magic Link
  revoke       <email>                → Eliminar todas las passkeys asociadas y cerrar sesiones activas
  reenroll     <email>                → Revocar passkey actual y enviar nuevo Magic Link de enrolamiento
  disable      <email>                → Suspender cuenta de administrador (baja temporal)
  enable       <email>                → Reactivar cuenta de administrador suspendida
  update-email <viejo> <nuevo>        → Modificar correo institucional, revocar passkey y re-enrolar
  status       <email>                → Consultar estado y logs del administrador
  list                                → Listar todos los administradores en el sistema
`);
}

async function handleCreate(email) {
  console.log(`\n⏳ Creando administrador: ${email}...`);
  
  // Verificar si ya existe
  const existing = await getAdminUser(email);
  if (existing) {
    throw new Error(`El usuario ${email} ya existe en el sistema.`);
  }

  // 1. Crear en auth.users
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { role: 'Admin' }
  });

  if (createError || !newUser.user) {
    throw new Error(`Error en auth.createUser: ${createError?.message}`);
  }

  const userId = newUser.user.id;
  const matricula = email.split('@')[0].substring(0, 50); // Generar matrícula basada en el email

  // 2. Insertar en public.users
  const { error: dbError } = await supabase
    .from('users')
    .insert({
      id: userId,
      matricula,
      role_id: 1, // ID de Admin
      passkey_only: false,
      is_active: true
    });

  if (dbError) {
    // Limpiar auth.users si falló la DB para mantener consistencia
    await supabase.auth.admin.deleteUser(userId);
    throw new Error(`Error insertando en public.users: ${dbError.message}`);
  }

  // Crear perfil en public.profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      first_name: 'Admin',
      last_name: 'Institucional'
    });

  if (profileError) {
    console.warn(`[Advertencia] No se pudo crear el perfil base: ${profileError.message}`);
  }

  // 3. Generar enlace de invitación (y enviarlo por correo)
  const { data: linkData, error: inviteError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${appUrl}/sistema/acceso?mode=register&email=${encodeURIComponent(email)}`
    }
  });

  if (inviteError) {
    console.warn(`[Advertencia] No se pudo generar el enlace de invitación: ${inviteError.message}`);
    console.log(`TI debe pedir al administrador entrar a: ${appUrl}/sistema/acceso?mode=register&email=${email} y solicitar enlace.`);
  } else {
    console.log(`📨 Correo de invitación enviado exitosamente (si SMTP está activo).`);
    if (linkData && linkData.properties && linkData.properties.action_link) {
      console.log(`\n🔗 Enlace de enrolamiento manual (TI lo puede entregar de forma segura):\n${linkData.properties.action_link}`);
    }
  }

  await logAudit(email, 'create', operator, { userId });
  console.log(`\n✅ Administrador creado con éxito.`);
  console.log(`ID: ${userId}`);
  console.log(`Matrícula asignada: ${matricula}`);
}

async function handleRevoke(email) {
  console.log(`\n⏳ Revocando credenciales para: ${email}...`);
  
  const user = await getAdminUser(email);
  if (!user) throw new Error(`El administrador ${email} no existe.`);

  // 1. Listar passkeys
  const { data: passkeys, error: listError } = await supabase.auth.admin.passkey.listPasskeys({
    userId: user.auth.id
  });

  if (listError) throw new Error(`Error listando passkeys: ${listError.message}`);

  // 2. Eliminar cada passkey
  let deletedCount = 0;
  if (passkeys && passkeys.length > 0) {
    for (const pk of passkeys) {
      const { error: delError } = await supabase.auth.admin.passkey.deletePasskey({
        userId: user.auth.id,
        passkeyId: pk.id
      });
      if (delError) {
        console.error(`Error eliminando passkey ${pk.id}: ${delError.message}`);
      } else {
        deletedCount++;
      }
    }
  }

  // 3. Forzar cierre de sesiones de base de datos
  const { error: sessionError } = await supabase.rpc('delete_user_sessions', {
    p_user_id: user.auth.id
  });

  if (sessionError) {
    console.warn(`[Advertencia] No se pudieron limpiar las sesiones activas en la BD: ${sessionError.message}`);
  }

  // 4. Actualizar public.users.passkey_only = FALSE
  const { error: updateError } = await supabase
    .from('users')
    .update({ passkey_only: false })
    .eq('id', user.auth.id);

  if (updateError) throw new Error(`Error actualizando estado en users: ${updateError.message}`);

  await logAudit(email, 'revoke', operator, { userId: user.auth.id, passkeysDeleted: deletedCount });
  console.log(`\n✅ Revocación completada. Se eliminaron ${deletedCount} passkeys y se invalidaron sesiones.`);
}

async function handleReenroll(email) {
  // 1. Revocar actual
  await handleRevoke(email);

  console.log(`\n⏳ Generando nuevo Magic Link de re-enrolamiento...`);
  
  // 2. Generar Magic Link usando generateLink
  const { data: linkData, error: otpError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${appUrl}/sistema/acceso?mode=register&email=${encodeURIComponent(email)}`
    }
  });

  if (otpError) throw new Error(`Error generando Magic Link: ${otpError.message}`);

  await logAudit(email, 'reenroll', operator);
  console.log(`📨 Magic Link enviado exitosamente al correo del administrador (si SMTP está activo).`);
  if (linkData && linkData.properties && linkData.properties.action_link) {
    console.log(`\n🔗 Enlace de re-enrolamiento manual (TI lo puede entregar de forma segura):\n${linkData.properties.action_link}`);
  }
  console.log(`El administrador deberá acceder y registrar su nuevo dispositivo.`);
}

async function handleDisable(email) {
  console.log(`\n⏳ Desactivando cuenta de administrador: ${email}...`);
  
  const user = await getAdminUser(email);
  if (!user) throw new Error(`El administrador ${email} no existe.`);

  // 1. Marcar is_active = false
  const { error: updateError } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', user.auth.id);

  if (updateError) throw new Error(`Error desactivando en DB: ${updateError.message}`);

  // 2. Forzar cierre de sesiones de base de datos
  await supabase.rpc('delete_user_sessions', { p_user_id: user.auth.id });

  await logAudit(email, 'disable', operator, { userId: user.auth.id });
  console.log(`\n✅ Administrador desactivado temporalmente. Acceso bloqueado.`);
}

async function handleEnable(email) {
  console.log(`\n⏳ Reactivando cuenta de administrador: ${email}...`);
  
  const user = await getAdminUser(email);
  if (!user) throw new Error(`El administrador ${email} no existe.`);

  // 1. Marcar is_active = true
  const { error: updateError } = await supabase
    .from('users')
    .update({ is_active: true })
    .eq('id', user.auth.id);

  if (updateError) throw new Error(`Error activando en DB: ${updateError.message}`);

  await logAudit(email, 'enable', operator, { userId: user.auth.id });
  console.log(`\n✅ Administrador reactivado con éxito.`);
}

async function handleUpdateEmail(oldEmail, newEmail) {
  console.log(`\n⏳ Modificando correo de ${oldEmail} a ${newEmail}...`);
  
  const user = await getAdminUser(oldEmail);
  if (!user) throw new Error(`El administrador con correo ${oldEmail} no existe.`);

  // 1. Cambiar correo en auth.users
  const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
    user.auth.id,
    { email: newEmail, email_confirm: true }
  );

  if (updateError) throw new Error(`Error en auth.updateUser: ${updateError.message}`);

  // 2. Revocar credenciales del correo anterior por seguridad
  await handleRevoke(newEmail); // Nota: handleRevoke buscará por el nuevo correo

  // 3. Generar Magic Link de re-enrolamiento al nuevo correo
  const { data: linkData, error: otpError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: newEmail,
    options: {
      redirectTo: `${appUrl}/sistema/acceso?mode=register&email=${encodeURIComponent(newEmail)}`
    }
  });

  if (otpError) throw new Error(`Error generando Magic Link al nuevo correo: ${otpError.message}`);

  await logAudit(newEmail, 'update_email', operator, { oldEmail, userId: user.auth.id });
  console.log(`\n✅ Correo modificado con éxito.`);
  console.log(`📨 Magic Link enviado al nuevo correo institucional (si SMTP está activo).`);
  if (linkData && linkData.properties && linkData.properties.action_link) {
    console.log(`\n🔗 Enlace de re-enrolamiento manual (TI lo puede entregar de forma segura):\n${linkData.properties.action_link}`);
  }
}

async function handleStatus(email) {
  const user = await getAdminUser(email);
  if (!user) throw new Error(`El administrador ${email} no existe.`);

  console.log(`
📊 ESTADO DEL ADMINISTRADOR: ${email}
===================================================
ID de Usuario:    ${user.auth.id}
Matrícula:        ${user.db?.matricula || 'N/A'}
Rol:              Administrador (role_id: 1)
Estado de cuenta: ${user.db?.is_active ? '✅ ACTIVO' : '❌ SUSPENDIDO'}
Passkey Activa:   ${user.db?.passkey_only ? '🛡️ OBLIGATORIA' : '⚠️ PENDIENTE ENROLAMIENTO'}
Creado en:        ${user.auth.created_at}
Último Acceso:    ${user.auth.last_sign_in_at || 'Nunca'}
  `);

  // Listar Passkeys registradas en el backend
  const { data: passkeys } = await supabase.auth.admin.passkey.listPasskeys({
    userId: user.auth.id
  });

  console.log(`🔑 Dispositivos WebAuthn Registrados:`);
  if (passkeys && passkeys.length > 0) {
    passkeys.forEach((pk, i) => {
      console.log(`  [${i + 1}] ID: ${pk.id} | Nombre: ${pk.friendly_name || 'Sin nombre'} | Creado: ${pk.created_at}`);
    });
  } else {
    console.log(`  (Ningún dispositivo registrado)`);
  }

  // Cargar últimos logs de auditoría
  const { data: logs } = await supabase
    .from('admin_audit_log')
    .select('action, performed_by, details, created_at')
    .eq('admin_email', email)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`\n📋 Historial de Auditoría (Últimos 5):`);
  if (logs && logs.length > 0) {
    logs.forEach(log => {
      console.log(`  [${log.created_at}] Acción: ${log.action} | Operador: ${log.performed_by} | Detalles: ${JSON.stringify(log.details)}`);
    });
  } else {
    console.log(`  (Sin logs registrados)`);
  }
}

async function handleList() {
  console.log(`\n⏳ Consultando lista de administradores...`);
  
  const { data: authUsers, error } = await supabase.auth.admin.listUsers();
  if (error) throw new Error(`Error obteniendo usuarios: ${error.message}`);

  const { data: dbUsers } = await supabase
    .from('users')
    .select('id, matricula, is_active, passkey_only')
    .eq('role_id', 1);

  const dbUserMap = {};
  if (dbUsers) {
    dbUsers.forEach(u => {
      dbUserMap[u.id] = u;
    });
  }

  const admins = authUsers.users.filter(u => dbUserMap[u.id]);

  console.log(`
👥 ADMINISTRADORES REGISTRADOS (${admins.length})
========================================================================================
Matrícula     | Correo Electrónico             | Estado     | Passkey      | Creado el
----------------------------------------------------------------------------------------`);
  
  admins.forEach(u => {
    const dbInfo = dbUserMap[u.id];
    const matricula = (dbInfo?.matricula || '').padEnd(13);
    const email = (u.email || '').padEnd(30);
    const estado = dbInfo?.is_active ? '✅ Activo   ' : '❌ Suspendido';
    const passkey = dbInfo?.passkey_only ? '🛡️ Activa   ' : '⚠️ Pendiente';
    const creado = new Date(u.created_at).toLocaleDateString();
    
    console.log(`${matricula} | ${email} | ${estado} | ${passkey} | ${creado}`);
  });
  console.log('========================================================================================');
}

run();
