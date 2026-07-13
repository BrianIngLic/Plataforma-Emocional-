const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAchievements() {
  console.log('\n=== TEST: Tabla "achievements" ===');
  const { data: achData, error: achErr } = await supabase
    .from('achievements')
    .select('*')
    .limit(5);
  
  if (achErr) {
    console.error('❌ Error:', achErr.message, achErr.code, achErr.details);
  } else {
    console.log(`✅ achievements encontrados: ${achData?.length ?? 0}`);
    if (achData?.length > 0) {
      console.log('   Columnas:', Object.keys(achData[0]).join(', '));
      console.log('   Primer registro:', JSON.stringify(achData[0], null, 2));
    }
  }

  console.log('\n=== TEST: Tabla "user_achievements" ===');
  const { data: uaData, error: uaErr } = await supabase
    .from('user_achievements')
    .select('*')
    .limit(5);
  
  if (uaErr) {
    console.error('❌ Error:', uaErr.message, uaErr.code, uaErr.details);
  } else {
    console.log(`✅ user_achievements encontrados: ${uaData?.length ?? 0}`);
    if (uaData?.length > 0) {
      console.log('   Columnas:', Object.keys(uaData[0]).join(', '));
    }
  }

  console.log('\n=== TEST: Tabla "user_streaks" ===');
  const { data: streakData, error: streakErr } = await supabase
    .from('user_streaks')
    .select('*')
    .limit(5);
  
  if (streakErr) {
    console.error('❌ Error:', streakErr.message, streakErr.code, streakErr.details);
  } else {
    console.log(`✅ user_streaks encontrados: ${streakData?.length ?? 0}`);
    if (streakData?.length > 0) {
      console.log('   Columnas:', Object.keys(streakData[0]).join(', '));
      console.log('   Primer registro:', JSON.stringify(streakData[0], null, 2));
    }
  }

  console.log('\n=== TEST: Función RPC "update_user_activity_streak" ===');
  // Probamos con un user_id ficticio para ver si la función existe
  const { data: rpcData, error: rpcErr } = await supabase.rpc('update_user_activity_streak', {
    p_user_id: '00000000-0000-0000-0000-000000000000',
    p_category: 'diary'
  });

  if (rpcErr) {
    console.error('❌ RPC Error:', rpcErr.message, rpcErr.code);
    console.error('   Detalles:', rpcErr.details);
    console.error('   Hint:', rpcErr.hint);
  } else {
    console.log('✅ RPC ejecutada:', JSON.stringify(rpcData, null, 2));
  }

  console.log('\n=== TEST: Tabla "achievement_categories" ===');
  const { data: catData, error: catErr } = await supabase
    .from('achievement_categories')
    .select('*');
  
  if (catErr) {
    console.error('❌ Error:', catErr.message, catErr.code);
  } else {
    console.log(`✅ categorías encontradas: ${catData?.length ?? 0}`);
    catData?.forEach(c => console.log('  -', c.id, ':', c.name));
  }
}

testAchievements().then(() => {
  console.log('\n=== Pruebas completadas ===');
  process.exit(0);
}).catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
