const { createClient } = require('c:\\Users\\guill\\Documents\\Plataforma-Emocional-\\node_modules\\@supabase\\supabase-js');

const supabaseUrl = 'https://vatuxmvzdhdgqttbvrny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHV4bXZ6ZGhkZ3F0dGJ2cm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDg3NjMsImV4cCI6MjA5NzI4NDc2M30.Vw5dP1a6X_D872ohFas09ewfJmH63F-yCIS4lF66-8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Running getReportsData queries...");
  try {
    const { data: appointments, error: apptErr } = await supabase
      .from('appointments')
      .select('id, student_id, professional_id, scheduled_date, start_time, end_time, status');
    if (apptErr) console.error("apptErr:", apptErr);
    else console.log("Appointments OK:", appointments.length);

    const { data: users, error: usersErr } = await supabase.from('users').select('id, role_id, created_at');
    if (usersErr) console.error("usersErr:", usersErr);
    else console.log("Users OK:", users.length);

    const { data: profiles, error: profilesErr } = await supabase.from('profiles').select('user_id, first_name, last_name, faculty');
    if (profilesErr) console.error("profilesErr:", profilesErr);
    else console.log("Profiles OK:", profiles.length);

    const { data: settings, error: settingsErr } = await supabase.from('patient_settings').select('patient_id, status, created_at');
    if (settingsErr) console.error("settingsErr:", settingsErr);
    else console.log("Patient Settings OK:", settings.length);

    const { data: evaluations, error: evalsErr } = await supabase.from('session_evaluations').select('appointment_id, score_global');
    if (evalsErr) console.error("evalsErr:", evalsErr);
    else console.log("Evaluations OK:", evaluations.length);

  } catch(e) {
    console.error("Exception:", e);
  }
}

run();
