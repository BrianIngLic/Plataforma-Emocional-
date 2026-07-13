const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  // Ver el registro existente en user_achievements
  console.log('=== user_achievements (registro existente) ===');
  const { data: ua, error: uaErr } = await supabase
    .from('user_achievements')
    .select('*');
  
  if (uaErr) {
    console.error('Error:', uaErr.message);
  } else {
    console.log('Registros:', ua?.length ?? 0);
    if (ua && ua.length > 0) {
      console.log('Columnas:', Object.keys(ua[0]).join(', '));
      ua.forEach(r => console.log(JSON.stringify(r, null, 2)));
    }
  }

  // Ver columnas de user_streaks con un registro existente
  console.log('\n=== user_streaks ===');
  const { data: us, error: usErr } = await supabase
    .from('user_streaks')
    .select('*');

  if (usErr) {
    console.error('Error:', usErr.message);
  } else {
    console.log('Registros:', us?.length ?? 0);
    if (us && us.length > 0) {
      console.log('Columnas:', Object.keys(us[0]).join(', '));
      us.forEach(r => console.log(JSON.stringify(r, null, 2)));
    }
  }
}

inspect().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
