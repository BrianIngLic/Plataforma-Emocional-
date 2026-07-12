const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('internal_meta_conversations')
    .select(`
      id,
      student_id,
      urgency_score,
      last_message,
      last_message_date,
      unread_count,
      student:student_id (
        mobile_phone,
        profiles (
          first_name,
          last_name,
          avatar_url,
          celular
        )
      )
    `);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Conversations raw data:');
  console.log(JSON.stringify(data, null, 2));
}

run();
