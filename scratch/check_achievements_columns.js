const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('--- Consultando columnas de public.achievements en producción ---');
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error consultando achievements:', error);
    } else if (data && data.length > 0) {
      console.log('✅ Un registro encontrado:', data[0]);
      console.log('🔑 Columnas reales en la tabla achievements:', Object.keys(data[0]));
    } else {
      console.log('⚠️ No hay registros en achievements, intentemos traer la estructura de otra forma.');
    }
  } catch (err) {
    console.error('❌ Excepción:', err);
  }
}

checkColumns();
