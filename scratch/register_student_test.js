const { createClient } = require('c:\\Users\\guill\\Documents\\Plataforma-Emocional-\\node_modules\\@supabase\\supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const email = `test_student_${Date.now()}@example.com`;
  const password = "Password123!";
  const matricula = `MAT${Math.floor(Math.random() * 1000000)}`;
  const firstName = "Test";
  const lastName = "Student";
  const faculty = "Facultad de Ciencias de la Computación (FCC)";

  console.log(`Attempting to sign up ${email}...`);

  // Step 1: Sign up
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password
  });

  if (authError) {
    console.error("Auth signUp error:", authError);
    return;
  }

  const userId = authData.user?.id;
  console.log("Auth signUp success! User ID:", userId);
  console.log("Session details:", authData.session);

  // Step 2: Insert into public.users
  console.log("Inserting into public.users...");
  const { data: userData, error: userError } = await supabase.from('users').insert({
    id: userId,
    matricula: matricula,
    role_id: 2,
    requires_password_change: false
  }).select();

  if (userError) {
    console.error("Error inserting into public.users:", userError);
  } else {
    console.log("Successfully inserted into public.users:", userData);
  }

  // Step 3: Insert into public.profiles
  console.log("Inserting into public.profiles...");
  const { data: profileData, error: profileError } = await supabase.from('profiles').insert({
    user_id: userId,
    first_name: firstName,
    last_name: lastName,
    faculty: faculty
  }).select();

  if (profileError) {
    console.error("Error inserting into public.profiles:", profileError);
  } else {
    console.log("Successfully inserted into public.profiles:", profileData);
  }
}

run();
