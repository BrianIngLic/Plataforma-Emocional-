const { createClient } = require('c:\\Users\\guill\\Documents\\Plataforma-Emocional-\\node_modules\\@supabase\\supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== ALL STUDENTS IN public.users ===");
  const { data: users, error: err } = await supabase
    .from('users')
    .select('id, matricula, role_id, profiles(first_name, last_name, faculty)')
    .eq('role_id', 2);
    
  if (err) {
    console.error("Error loading users:", err);
  } else {
    console.log(`Found ${users.length} users:`);
    users.forEach(u => {
      console.log(`ID: ${u.id}, Matricula: ${u.matricula}, Role ID: ${u.role_id}`);
      console.log(`  Profiles:`, u.profiles);
    });
  }
}

run();
