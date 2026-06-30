import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "https://esm.sh/web-push@3.6.7";

// Configuración VAPID (Las llaves se guardan de forma segura en Supabase Vault / Secrets)
// Generadas con: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || 'BNcRdreYL8h...';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || 'PRIVATE_KEY...';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@emocional.buap.mx';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    const payload = await req.json();
    console.log('⚡ [Webhook Edge Function]: Evento recibido desde PostgreSQL:', payload);

    const record = payload.record || payload;
    const studentId = record.student_id;

    if (!studentId || !record.emergency_change_type) {
      return new Response(JSON.stringify({ message: 'No es un cambio de emergencia o falta student_id' }), { status: 200 });
    }

    // 1. Obtener todas las suscripciones PWA del estudiante
    const { data: subscriptions, error: subsError } = await supabase
      .from('web_push_subscriptions')
      .select('*')
      .eq('user_id', studentId);

    if (subsError || !subscriptions || subscriptions.length === 0) {
      console.log(`⚠️ No se encontraron suscripciones Web Push para el alumno ${studentId}`);
      return new Response(JSON.stringify({ message: 'No subscriptions found' }), { status: 200 });
    }

    // 2. Construir el título y mensaje del Push
    let title = '🚨 BUAP Asistencia: Aviso Urgente de tu Tratante';
    if (record.emergency_change_type === 'cancel') title = '❌ BUAP Asistencia: Cita Cancelada por Emergencia';
    if (record.emergency_change_type === 'virtual') title = '🌐 BUAP Asistencia: Cita Trasladada a Virtual';
    if (record.emergency_change_type === 'relocate') title = '📍 BUAP Asistencia: Reubicación de Consultorio';

    const body = record.emergency_change_details || 'Tu especialista ha modificado los detalles de tu cita.';
    
    const notificationPayload = JSON.stringify({
      title,
      body,
      icon: '/amati-logo.svg',
      badge: '/amati-logo.svg',
      data: {
        appointmentId: record.id,
        url: '/dashboard',
        date: record.cancellation_notified_at
      }
    });

    console.log(`🚀 Transmitiendo paquete VAPID a ${subscriptions.length} endpoints PWA...`);

    // 3. Emitir el Push Protocol a los servidores de Google FCM / Microsoft WNS
    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, notificationPayload);
        console.log(`✅ Push enviado exitosamente a endpoint: ${sub.endpoint}`);
        return { success: true, endpoint: sub.endpoint };
      } catch (err: any) {
        console.error(`❌ Error enviando push a ${sub.endpoint}:`, err);
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          // El usuario revocó el permiso o cambió de equipo. Limpiar suscripción muerta.
          console.log(`🗑️ Eliminando suscripción inactiva: ${sub.endpoint}`);
          await supabase.from('web_push_subscriptions').delete().eq('id', sub.id);
        }
        return { success: false, endpoint: sub.endpoint, error: err?.message };
      }
    });

    const results = await Promise.allSettled(sendPromises);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('❌ Error fatal en Edge Function emergency-web-push:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
