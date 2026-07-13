const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWithRealUser() {
  // Primero encontremos un usuario real con rol de Estudiante
  console.log('\n=== Buscando usuarios estudiantes ===');
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, name, role, email')
    .eq('role', 'Estudiante')
    .limit(3);

  if (usersErr) {
    console.error('❌ Error buscando usuarios:', usersErr.message, usersErr.code);
    console.log('   Intentando sin filtro de rol...');

    const { data: allUsers, error: allErr } = await supabase
      .from('users')
      .select('id, name, role')
      .limit(5);
    
    if (allErr) {
      console.error('❌ Error:', allErr.message);
    } else {
      console.log('Usuarios encontrados:', allUsers?.length ?? 0);
      allUsers?.forEach(u => console.log(' -', u.id, ':', u.name, '(', u.role, ')'));
    }
    return;
  }

  console.log(`✅ Usuarios estudiantes: ${users?.length ?? 0}`);
  users?.forEach(u => console.log(' -', u.id, ':', u.name));

  if (!users?.length) {
    console.log('No hay usuarios estudiantes, intentando encontrar cualquier usuario...');
    const { data: anyUser } = await supabase.from('users').select('id, name, role').limit(1).single();
    if (anyUser) {
      console.log('Usuario encontrado:', anyUser.id, anyUser.name, anyUser.role);
      users?.push(anyUser);
    }
    return;
  }

  const testUser = users[0];
  console.log(`\n=== Probando RPC con usuario real: ${testUser.id} ===`);
  
  const { data: rpcData, error: rpcErr } = await supabase.rpc('update_user_activity_streak', {
    p_user_id: testUser.id,
    p_category: 'diary'
  });

  if (rpcErr) {
    console.error('❌ RPC Error:', rpcErr.message);
    console.error('   Code:', rpcErr.code);
    console.error('   Detalles:', rpcErr.details);
    console.error('   Hint:', rpcErr.hint);
  } else {
    console.log('✅ RPC ejecutada exitosamente:', JSON.stringify(rpcData, null, 2));
    
    // Verificar si se creó la racha
    const { data: streak } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', testUser.id)
      .maybeSingle();
    console.log('\n=== Racha del usuario después de RPC ===');
    console.log(JSON.stringify(streak, null, 2));
    
    // Verificar logros desbloqueados
    const { data: uAch } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', testUser.id);
    console.log('\n=== Logros desbloqueados ===');
    console.log(JSON.stringify(uAch, null, 2));
  }

  console.log('\n=== Verificando definición de la función RPC ===');
  const { data: funcDef, error: funcErr } = await supabase
    .from('information_schema.routines')
    .select('routine_name, security_type, routine_definition')
    .eq('routine_name', 'update_user_activity_streak')
    .limit(1);
  
  if (funcErr) {
    console.log('No se puede consultar information_schema desde anon:', funcErr.message);
  } else {
    console.log('Definición:', JSON.stringify(funcDef, null, 2));
  }
}

testWithRealUser().then(() => {
  console.log('\n=== Test completado ===');
  process.exit(0);
}).catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
