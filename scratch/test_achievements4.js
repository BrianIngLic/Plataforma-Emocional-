const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  // Ver todos los usuarios y sus role_ids
  console.log('\n=== Usuarios en la BD ===');
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, role_id, matricula')
    .limit(10);

  if (usersErr) {
    console.error('❌ Error en users:', usersErr.message);
  } else {
    console.log('Usuarios:', users?.length ?? 0);
    users?.forEach(u => console.log(` - ID: ${u.id}, role_id: ${u.role_id}, matricula: ${u.matricula}`));
  }

  // Ver tabla de roles
  console.log('\n=== Tabla de roles ===');
  const { data: roles, error: rolesErr } = await supabase
    .from('roles')
    .select('*');

  if (rolesErr) {
    console.error('❌ Error en roles:', rolesErr.message);
  } else {
    console.log('Roles:', JSON.stringify(roles, null, 2));
  }

  // Tomar un usuario estudiante (buscar por role_id 2 o el que corresponda)
  if (users && users.length > 0) {
    const userId = users[0].id;
    console.log(`\n=== Probando RPC con usuario ID: ${userId} (role_id: ${users[0].role_id}) ===`);
    
    const { data: rpcData, error: rpcErr } = await supabase.rpc('update_user_activity_streak', {
      p_user_id: userId,
      p_category: 'diary'
    });

    if (rpcErr) {
      console.error('❌ RPC Error:', rpcErr.message);
      console.error('   Code:', rpcErr.code);
      console.error('   Detalles:', rpcErr.details);
      console.error('   Hint:', rpcErr.hint);
    } else {
      console.log('✅ RPC resultado:', JSON.stringify(rpcData, null, 2));
      
      const { data: streak } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      console.log('\nRacha creada:', JSON.stringify(streak, null, 2));

      const { data: uAch } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId);
      console.log('\nLogros desbloqueados:', JSON.stringify(uAch, null, 2));
    }
  }

  // Ver si la función existe en el schema pg_catalog
  console.log('\n=== Verificar funciones RPC disponibles (via pg_proc) ===');
  const { data: fnCheck, error: fnErr } = await supabase
    .rpc('update_user_activity_streak', {
      p_user_id: null,
      p_category: 'test'
    });
  
  if (fnErr) {
    console.log('RPC status con null:', fnErr.message, fnErr.code);
  }
}

inspectSchema().then(() => {
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
