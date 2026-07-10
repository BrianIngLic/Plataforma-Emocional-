import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WA_BUSINESS_PHONE   = Deno.env.get("META_WA_BUSINESS_PHONE") ?? "523112670160"; // número sin +
const HOURS_BEFORE_EXPIRY = 4; // avisar cuando falten 4h para que expire la ventana de 24h

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();

  console.log(`🔍 [WA Keep-Alive]: Revisando sesiones por vencer... ${now.toISOString()}`);

  // Estudiantes con cita en los próximos 7 días cuya ventana de WhatsApp
  // expira en las próximas HOURS_BEFORE_EXPIRY horas
  const ventanaLimite = new Date(now.getTime() - (24 - HOURS_BEFORE_EXPIRY) * 3_600_000).toISOString();

  const { data: estudiantesEnRiesgo, error } = await supabase
    .from("users")
    .select(`
      id,
      mobile_phone,
      whatsapp_opt_in,
      wa_last_interaction_at,
      profiles(first_name)
    `)
    .eq("role_id", 2)                          // solo estudiantes
    .eq("whatsapp_opt_in", true)               // que hayan dado opt-in
    .not("mobile_phone", "is", null)           // que tengan teléfono
    .or(`wa_last_interaction_at.is.null,wa_last_interaction_at.lte.${ventanaLimite}`)
    // ↑ ventana nunca abierta O está por vencer
    .limit(50);

  if (error) {
    console.error("❌ Error consultando estudiantes:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!estudiantesEnRiesgo || estudiantesEnRiesgo.length === 0) {
    console.log("✅ No hay sesiones de WhatsApp por vencer. Todo en orden.");
    return new Response(JSON.stringify({ ok: true, renovados: 0 }), { status: 200 });
  }

  console.log(`⚠️ ${estudiantesEnRiesgo.length} sesiones de WhatsApp por vencer.`);

  let renovados = 0;
  const mensajeRenovacion = encodeURIComponent(
    "Hola BUAP Asistencia, confirmo que deseo mantener activas mis notificaciones de emergencia por WhatsApp."
  );
  const waLink = `https://wa.me/${WA_BUSINESS_PHONE}?text=${mensajeRenovacion}`;

  for (const estudiante of estudiantesEnRiesgo) {
    const nombre = (estudiante as any).profiles?.first_name ?? "Estudiante";

    // ── Notificar via Supabase Realtime (canal personal del estudiante) ──────
    const channel = supabase.channel(`emergency_room_${estudiante.id}`);
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: `wa_keepalive_${estudiante.id}`,
            payload: {
              type: "wa_keepalive",
              titulo: "📱 Renueva tu contacto WhatsApp",
              mensaje: `Hola ${nombre}, tu sesión de notificaciones de emergencia por WhatsApp está por vencer. Toca para renovarla con un solo mensaje.`,
              wa_link: waLink,
              timestamp: now.toISOString()
            }
          });
          resolve();
        }
      });
    });

    // Pequeña pausa para no saturar el canal
    await new Promise((r) => setTimeout(r, 200));
    renovados++;
    console.log(`📤 Aviso enviado a estudiante ${estudiante.id} (${nombre})`);
  }

  return new Response(
    JSON.stringify({ ok: true, renovados, total: estudiantesEnRiesgo.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
