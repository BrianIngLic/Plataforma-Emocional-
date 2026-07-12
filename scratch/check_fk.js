const { createClient } = require('c:\\Users\\guill\\Documents\\Plataforma-Emocional-\\node_modules\\@supabase\\supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching all users...");
  const { data: users } = await supabase.from('users').select('id');
  const userIds = new Set(users.map(u => u.id));
  console.log("User IDs in users table:", Array.from(userIds));

  console.log("Fetching all profiles...");
  const { data: profiles } = await supabase.from('profiles').select('user_id, first_name, last_name, faculty');
  console.log(`Found ${profiles.length} profiles.`);
  
  const orphanedProfiles = [];
  profiles.forEach(p => {
    if (!userIds.has(p.user_id)) {
      orphanedProfiles.push(p);
    }
  });

  console.log(`Found ${orphanedProfiles.length} profiles without matching user in users table:`);
  orphanedProfiles.forEach(p => {
    console.log(`  User ID: ${p.user_id}, Name: ${p.first_name} ${p.last_name}, Faculty: ${p.faculty}`);
  });
}

run();
