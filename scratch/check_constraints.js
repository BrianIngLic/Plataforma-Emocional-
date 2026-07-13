const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUAConstraint() {
  console.log('=== Verificando constraint en user_achievements ===');
  
  // Intentar insertar dos veces para verificar si hay UNIQUE constraint
  const testUserId = '08c42e43-aa91-4259-869b-c4ef06f2cbb1';
  const testAchId = 'b051a802-6f79-4d89-827b-537dd67ad4d3'; // primer logro
  
  const { error: insert1 } = await supabase
    .from('user_achievements')
    .insert({ user_id: testUserId, achievement_id: testAchId, progress: 1, is_completed: false });
  
  console.log('Insert 1:', insert1 ? `Error: ${insert1.message} (${insert1.code})` : 'OK');
  
  if (!insert1) {
    const { error: insert2 } = await supabase
      .from('user_achievements')
      .insert({ user_id: testUserId, achievement_id: testAchId, progress: 1, is_completed: false });
    console.log('Insert 2 (duplicado):', insert2 ? `Error: ${insert2.message} (${insert2.code})` : 'OK - No tiene UNIQUE constraint!');
    
    // Limpiar
    const { error: delErr } = await supabase
      .from('user_achievements')
      .delete()
      .eq('user_id', testUserId);
    console.log('Limpieza:', delErr ? `Error: ${delErr.message}` : 'OK');
  }
  
  // Verificar columnas de user_achievements
  const { data: ua1 } = await supabase
    .from('user_achievements')
    .select('*')
    .limit(1);
  console.log('\nRegistros en user_achievements:', ua1?.length ?? 0);
}

checkUAConstraint().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
