import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Manejo de peticiones preflight (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    // Importación dinámica de nodemailer para compatibilidad en Deno Deploy
    const nodemailerModule = await import("npm:nodemailer");
    const nodemailer = nodemailerModule.default || nodemailerModule;

    // Inicializar cliente Supabase con Service Role Key (para omitir RLS y acceder a la función RPC)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Faltan las credenciales de Supabase (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Validar configuración SMTP
    const user = Deno.env.get('SMTP_USER');
    const pass = Deno.env.get('SMTP_PASS');
    const host = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
    const port = parseInt(Deno.env.get('SMTP_PORT') || '465');
    const secure = Deno.env.get('SMTP_SECURE') === 'true' || port === 465;

    if (!user || !pass) {
      throw new Error("Faltan las credenciales SMTP_USER o SMTP_PASS en los secretos de la Edge Function");
    }

    // Configurar transporte nodemailer
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    // ponytail: usa función RPC segura para evitar hacer joins complejos con auth.users en Deno y centralizar filtros de tiempo
    const { data: appointments, error: fetchError } = await supabase.rpc('get_appointments_for_reminder');

    if (fetchError) throw fetchError;

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No hay citas programadas para notificar en las próximas 24 horas" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`📅 Se encontraron ${appointments.length} cita(s) para enviar recordatorio.`);
    const appUrl = Deno.env.get('APP_URL') || 'https://amati-app.vercel.app';
    const sentAppointments: string[] = [];

    // 2. Enviar correos
    for (const appt of appointments) {
      try {
        const studentName = `${appt.student_first_name} ${appt.student_last_name}`.trim();
        const profName = `${appt.prof_first_name} ${appt.prof_last_name}`.trim();
        const dateObj = new Date(appt.scheduled_date);
        
        // Formatear fecha legible
        const options: Intl.DateTimeFormatOptions = { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        };
        const dateFormatted = dateObj.toLocaleDateString('es-ES', options);

        // Formatear hora de inicio y fin
        const startTimeStr = appt.start_time ? appt.start_time.substring(0, 5) : '';
        const endTimeStr = appt.end_time ? appt.end_time.substring(0, 5) : '';
        const timeFormatted = `${startTimeStr} - ${endTimeStr}`;

        // Determinar rol del especialista en español
        let profRoleEs = 'Especialista';
        if (appt.prof_role === 'Psicologo') profRoleEs = 'Psicólogo(a)';
        if (appt.prof_role === 'Nutricionista') profRoleEs = 'Nutriólogo(a)';

        // Detalles del lugar de atención
        let locationDetailsHtml = '';
        if (appt.modality === 'presencial') {
          locationDetailsHtml = `
            <p style="margin: 6px 0; color: #475569; font-size: 14px;"><strong>Modalidad:</strong> Presencial (En Campus)</p>
            <p style="margin: 6px 0; color: #475569; font-size: 14px;"><strong>Facultad:</strong> ${appt.faculty_name || 'No especificada'}</p>
            <p style="margin: 6px 0; color: #475569; font-size: 14px;"><strong>Edificio:</strong> ${appt.building || 'No especificado'}</p>
            <p style="margin: 6px 0; color: #475569; font-size: 14px;"><strong>Consultorio/Aula:</strong> ${appt.office_room || 'No especificado'}</p>
          `;
          if (appt.virtual_tour_url) {
            locationDetailsHtml += `
              <p style="margin: 12px 0 0 0; font-size: 14px;">
                <a href="${appt.virtual_tour_url}" target="_blank" style="color: #6366f1; font-weight: 600; text-decoration: underline;">
                  📍 Abrir Recorrido Virtual 360 de tu Facultad
                </a>
              </p>
            `;
          }
        } else {
          locationDetailsHtml = `
            <p style="margin: 6px 0; color: #475569; font-size: 14px;"><strong>Modalidad:</strong> Virtual (Videollamada)</p>
            <p style="margin: 6px 0; color: #475569; font-size: 14px;">
              <strong>Enlace de sesión:</strong> 
              <a href="${appt.location || '#'}" target="_blank" style="color: #6366f1; text-decoration: underline; font-weight: 500;">
                ${appt.location || 'Consultorio Virtual'}
              </a>
            </p>
          `;
        }

        // Estructurar el HTML premium del correo
        const mailOptions = {
          from: `"Amati" <${user}>`,
          to: appt.student_email,
          subject: `Amati: Recordatorio de tu cita de mañana - ${startTimeStr} hs`,
          html: `
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Recordatorio de Cita - Amati</title>
              <style>
                body {
                  margin: 0;
                  padding: 0;
                  background-color: #f8fafc;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                }
              </style>
            </head>
            <body style="background-color: #f8fafc; padding: 20px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);">
                
                <!-- Encabezado Premium -->
                <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 24px; text-align: center; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Amati</h1>
                  <p style="margin: 8px 0 0 0; font-size: 14px; font-weight: 500; color: rgba(255, 255, 255, 0.85); text-transform: uppercase; letter-spacing: 1px;">
                    Ecosistema de Asistencia Emocional
                  </p>
                </div>
                
                <!-- Cuerpo del Correo -->
                <div style="padding: 32px 24px;">
                  <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px;">
                    ¡Hola, ${studentName}! 👋
                  </h2>
                  <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                    Este es un recordatorio de que tienes una cita programada para mañana en la plataforma <strong>Amati</strong> para continuar con tu seguimiento y bienestar emocional.
                  </p>
                  
                  <!-- Detalles de la cita (Baja de Estilo Zero-Trust) -->
                  <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; border-radius: 0 12px 12px 0; padding: 20px; margin: 24px 0;">
                    <h3 style="color: #0f172a; font-size: 16px; font-weight: 600; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Detalles de tu Cita
                    </h3>
                    
                    <p style="margin: 6px 0; color: #475569; font-size: 14px;"><strong>Fecha:</strong> ${dateFormatted}</p>
                    <p style="margin: 6px 0; color: #475569; font-size: 14px;"><strong>Hora:</strong> ${timeFormatted}</p>
                    <p style="margin: 6px 0; color: #475569; font-size: 14px;"><strong>${profRoleEs}:</strong> ${profName}</p>
                    
                    <!-- Lógica dinámica de modalidad -->
                    ${locationDetailsHtml}
                  </div>

                  <!-- Notificación sobre políticas -->
                  <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 20px 0;">
                    ⚠️ <strong>Recuerda:</strong> Si necesitas cancelar o reagendar, debes hacerlo desde la plataforma con al menos <strong>72 horas de anticipación</strong>. Las inasistencias o cancelaciones tardías repetidas impactan en tus límites de sesiones académicas.
                  </p>
                  
                  <!-- Botón CTA -->
                  <div style="text-align: center; margin: 32px 0 24px 0;">
                    <a href="${appUrl}/dashboard" target="_blank" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 9999px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2);">
                      Ingresar a mi Cuenta
                    </a>
                  </div>
                  
                  <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                    Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br>
                    <a href="${appUrl}/dashboard" target="_blank" style="color: #6366f1; text-decoration: underline;">
                      ${appUrl}/dashboard
                    </a>
                  </p>
                </div>
                
                <!-- Pie de página (NOM-024 / HIPAA) -->
                <div style="background-color: #f1f5f9; padding: 20px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="margin: 0; color: #64748b; font-size: 11px; line-height: 1.5;">
                    <strong>Aviso de Seguridad y Privacidad (NOM-024 / HIPAA):</strong> Esta es una notificación de carácter puramente operativo y administrativo. En cumplimiento con la protección de datos de salud, este mensaje no contiene diagnósticos, recetas ni información clínica sensible.
                  </p>
                  <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 11px;">
                    © ${new Date().getFullYear()} Amati Ecosistema Emocional. Todos los derechos reservados.
                  </p>
                </div>
                
              </div>
            </body>
            </html>
          `
        };

        // Enviar el correo
        await transporter.sendMail(mailOptions);

        // 3. Marcar cita como notificada en la base de datos
        const { error: updateError } = await supabase
          .from('appointments')
          .update({ reminder_24h_sent: true })
          .eq('id', appt.appointment_id);

        if (updateError) {
          console.error(`❌ Error al marcar cita ${appt.appointment_id} como recordada:`, updateError.message);
        } else {
          sentAppointments.push(appt.appointment_id);
          console.log(`✅ Recordatorio enviado exitosamente al paciente ${appt.student_email} para cita ${appt.appointment_id}`);
        }

      } catch (err: any) {
        console.error(`❌ Error al procesar recordatorio para cita ${appt.appointment_id}:`, err.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: `Recordatorios enviados: ${sentAppointments.length}`, sent: sentAppointments }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error("❌ Error en Edge Function send-appointment-reminder:", error.message);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
