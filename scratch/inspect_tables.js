const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectAllTables() {
  const tables = [
    'diary_entries',
    'food_diary_entries',
    'appointments',
    'chat_messages',
    'user_achievements',
    'user_streaks',
    'achievements'
  ];

  for (const tableName of tables) {
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    if (error) {
      console.log(`\n❌ ${tableName}: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`\n✅ ${tableName}: ${Object.keys(data[0]).join(', ')}`);
    } else {
      console.log(`\n✅ ${tableName}: (vacía, pero accesible)`);
      
      // Intentar insertar y ver error para obtener las columnas
      const { error: insertErr } = await supabase.from(tableName).insert({}).select();
      if (insertErr) {
        console.log(`   Columnas requeridas del error: ${insertErr.message}`);
      }
    }
  }
}

inspectAllTables().then(() => {
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
