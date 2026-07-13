const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  console.log('\n=== Inspeccionando tabla "users" ===');
  const { data: user1, error: userErr } = await supabase
    .from('users')
    .select('*')
    .limit(1);

  if (userErr) {
    console.error('❌ Error en users:', userErr.message);
  } else {
    console.log(`✅ Columnas disponibles: ${Object.keys(user1?.[0] ?? {}).join(', ')}`);
    console.log('Datos:', JSON.stringify(user1?.[0], null, 2));
  }

  console.log('\n=== Buscando usuarios con rol Estudiante ===');
  const { data: students, error: studErr } = await supabase
    .from('users')
    .select('id, role')
    .limit(5);

  if (studErr) {
    console.error('❌ Error:', studErr.message);
  } else {
    console.log('Usuarios:', students?.length ?? 0);
    students?.forEach(u => console.log(' -', u.id, ':', u.role));
  }

  if (students && students.length > 0) {
    const userId = students[0].id;
    console.log(`\n=== Probando RPC con usuario ID: ${userId} ===`);
    
    const { data: rpcData, error: rpcErr } = await supabase.rpc('update_user_activity_streak', {
      p_user_id: userId,
      p_category: 'diary'
    });

    if (rpcErr) {
      console.error('❌ RPC Error:', rpcErr.message, rpcErr.code);
      console.error('   Detalles:', rpcErr.details);
      console.error('   Hint:', rpcErr.hint);
    } else {
      console.log('✅ RPC resultado:', JSON.stringify(rpcData, null, 2));
      
      const { data: streak } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      console.log('\nRacha:', JSON.stringify(streak, null, 2));

      const { data: uAch } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId);
      console.log('\nLogros:', JSON.stringify(uAch, null, 2));
    }
  }
}

inspectSchema().then(() => {
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
