const { createClient } = require('c:\\Users\\guill\\Documents\\Plataforma-Emocional-\\node_modules\\@supabase\\supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking patient_id via join...");
  const res1 = await supabase.from('users').select('patient_settings(patient_id, status)').limit(1);
  if (res1.error) console.log("patient_id Join Error:", res1.error.message);
  else console.log("patient_id Join Success!");

  console.log("Checking student_id via join...");
  const res2 = await supabase.from('users').select('patient_settings(student_id, status)').limit(1);
  if (res2.error) console.log("student_id Join Error:", res2.error.message);
  else console.log("student_id Join Success!");
}

run();
