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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Obtener la llave del environment secreto (el usuario la llamó "Primary")
    const primaryKey = Deno.env.get('Primary') || Deno.env.get('primary');
    if (!primaryKey) {
      throw new Error("La variable de entorno 'Primary' o 'primary' no está definida.");
    }

    // Insertar/actualizar en la tabla de llaves
    const { error } = await supabaseClient
      .from('encryption_keys')
      .upsert({
        version: 1,
        key_value: primaryKey,
        active: true
      }, { onConflict: 'version' });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, message: "Llave de cifrado vinculada exitosamente en la base de datos." }), {
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
