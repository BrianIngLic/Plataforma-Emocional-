import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Usar Service Role Key para Admin API
      { auth: { persistSession: false } }
    );

    const { email, matricula, firstName, lastName, faculty, cedula, capacity } = await req.json();

    // 1. Enviar invitación nativa de Supabase Auth
    const { data: inviteData, error: inviteError } = await supabaseClient.auth.admin.inviteUserByEmail(email, {
      data: { matricula, first_name: firstName, last_name: lastName, faculty, cedula }
    });

    if (inviteError) throw inviteError;

    const userId = inviteData.user.id;

    // 2. Insertar en public.users con role_id = 3 (Psicólogo)
    await supabaseClient.from('users').insert({
      id: userId,
      matricula: matricula,
      role_id: 3,
      requires_password_change: true
    });

    // 3. Insertar en public.profiles (SIN GUARDAR EMAIL EN BD PÚBLICA)
    await supabaseClient.from('profiles').insert({
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      faculty: faculty,
      cedula: cedula
    });

    // 4. Guardar configuración del psicólogo
    await supabaseClient.from('psychologist_settings').insert({
      psychologist_id: userId,
      capacity: capacity
    });

    return new Response(JSON.stringify({ success: true, user: inviteData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
