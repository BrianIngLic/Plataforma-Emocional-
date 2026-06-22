import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  // Manejo de peticiones preflight (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  try {
    // Importación dinámica para que no crashee la función al arrancar y podamos ver el error real
    const nodemailerModule = await import("npm:nodemailer");
    const nodemailer = nodemailerModule.default || nodemailerModule;

    const body = await req.json()
    const { email, name, password, pdfBase64 } = body

    // Validar secretos
    const user = Deno.env.get('SMTP_USER')
    const pass = Deno.env.get('SMTP_PASS')
    
    if (!user || !pass) {
      throw new Error("Faltan las credenciales SMTP_USER o SMTP_PASS en los secretos de Supabase")
    }

    const host = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com'
    const port = parseInt(Deno.env.get('SMTP_PORT') || '465')
    const secure = Deno.env.get('SMTP_SECURE') === 'true' || port === 465

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    })

    const mailOptions = {
      from: `"Plataforma Emocional" <${user}>`,
      to: email,
      subject: "¡Bienvenido a Plataforma Emocional - Credenciales de Acceso!",
      text: `Estimado/a ${name},\n\nBienvenido al sistema. Se adjuntan sus credenciales en PDF.\n\nSaludos.`,
      html: `
        <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #3b82f6; padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0;">Plataforma de Asistencia Emocional</h2>
          </div>
          <div style="padding: 30px;">
            <p>Estimado/a <strong>${name}</strong>,</p>
            <p>Su cuenta como especialista clínico ha sido habilitada exitosamente.</p>
            <p>Adjunto a este correo encontrará un documento oficial en formato PDF con su enlace de acceso y su <strong>contraseña provisional</strong>.</p>
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #b91c1c;"><em>El sistema le exigirá establecer una contraseña segura propia en su primer inicio de sesión.</em></p>
            </div>
            <p>Saludos cordiales,<br><strong>El Equipo de Administración</strong></p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Credenciales_${name ? name.replace(/ /g, '_') : 'Usuario'}.pdf`,
          content: pdfBase64,
          encoding: 'base64'
        }
      ]
    }

    const info = await transporter.sendMail(mailOptions)

    return new Response(
      JSON.stringify({ message: "Correo enviado exitosamente", info }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error("Error en la Edge Function:", error.message)
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
