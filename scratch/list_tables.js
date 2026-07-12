const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const tables = ['food_diary_entries', 'food_diary', 'diario_alimentario', 'diario_alimenticio', 'nutrition_logs', 'diary_entries'];
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(5);
      console.log(`Table: ${table} | Error: ${error ? error.message : 'None'} | Data:`, data);
    } catch (e) {
      console.log(`Table: ${table} | Exception:`, e.message);
    }
  }
}

run();
