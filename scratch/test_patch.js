const { createClient } = require('c:\\Users\\guill\\Documents\\Plataforma-Emocional-\\node_modules\\@supabase\\supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Getting a valid profile...");
  const { data: profile, error: getErr } = await supabase
    .from('profiles')
    .select('user_id')
    .limit(1)
    .single();

  if (getErr || !profile) {
    console.error("Error getting profile:", getErr);
    return;
  }

  const userId = profile.user_id;
  console.log("Simulating update for user:", userId);

  const updatePayload = {
    first_name: "Test",
    last_name: "User",
    faculty: "Facultad de Ciencias de la Computación (FCC)",
    programa_educativo: "Licenciatura en Ciencias de la Computación",
    fecha_nacimiento: "2000-01-01",
    sexo: "Masculino",
    expediente_completo: { data: "test-encrypted-string" }
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('user_id', userId)
    .select();

  if (error) {
    console.error("PATCH failed!");
    console.error("Message:", error.message);
    console.error("Details:", error.details);
    console.error("Hint:", error.hint);
    console.error("Code:", error.code);
  } else {
    console.log("PATCH succeeded! Data:", data);
  }
}

run();
