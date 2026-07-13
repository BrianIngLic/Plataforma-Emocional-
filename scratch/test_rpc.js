const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('--- Probando llamada RPC remota ---');
  try {
    const { data, error } = await supabase.rpc('update_user_activity_streak', {
      p_user_id: '13d6ac98-8983-4b76-be3f-88442b5816bd',
      p_category: 'amati'
    });

    if (error) {
      console.error('❌ Error de Supabase:', error);
    } else {
      console.log('✅ Resultado Exitoso:', data);
    }
  } catch (err) {
    console.error('❌ Excepción atrapada:', err);
  }
}

runTest();
