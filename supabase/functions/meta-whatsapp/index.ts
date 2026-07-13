import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_ACCESS_TOKEN = Deno.env.get('META_WA_ACCESS_TOKEN') || Deno.env.get('META_ACCESS_TOKEN') || '';
const META_PHONE_NUMBER_ID = Deno.env.get('META_WA_PHONE_NUMBER_ID') || Deno.env.get('META_PHONE_NUMBER_ID') || '';
const META_VERIFY_TOKEN = Deno.env.get('META_WA_VERIFY_TOKEN') || Deno.env.get('META_VERIFY_TOKEN') || 'mySuperSecretVerifyToken123';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: Request) => {
  // Manejo de peticiones preflight (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // 1. WEBHOOK VERIFICATION (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    console.log(`hub.verify_token received: "${token}" | expected: "${META_VERIFY_TOKEN}"`);

    if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
      console.log("✅ Webhook verificado correctamente con Meta");
      return new Response(challenge, { status: 200 });
    }
    console.error("❌ Fallo en la verificación del token de Meta");
    return new Response("Forbidden", { status: 403 });
  }

  // 2. PROCESAMIENTO DE WEBHOOKS Y LLAMADAS ENTRANTE (POST)
  if (req.method === 'POST') {
    try {
      const payload = await req.json();

      // Guardar log del webhook entrante para fines de auditoría si es de Meta
      if (payload.object === "whatsapp_business_account") {
        await supabase.from('webhook_logs').insert({
          provider: 'whatsapp_meta',
          event_type: payload.entry?.[0]?.changes?.[0]?.field || 'unknown',
          payload: payload,
          headers: {
            'user-agent': req.headers.get('user-agent'),
            'x-hub-signature-256': req.headers.get('x-hub-signature-256')
          },
          status: 'received'
        });

        const change = payload.entry?.[0]?.changes?.[0]?.value;

        // A. CASO: MENSAJE ENTRANTE (Estudiante -> WhatsApp -> Plataforma)
        if (change?.messages && change.messages.length > 0) {
          const message = change.messages[0];
          const waId = message.from; // Número de WhatsApp del alumno
          const messageId = message.id;
          const bodyText = message.text?.body || '[Mensaje no de texto]';
          const senderName = change.contacts?.[0]?.profile?.name || 'Alumno';

          console.log(`📱 Mensaje entrante de WhatsApp: ${waId} - ${bodyText}`);

          // Buscar al estudiante en base de datos. Comparamos con prefijo del país desinfectado.
          const cleanedPhone = waId.replace(/\D/g, ''); // Solo dígitos
          const last10Digits = cleanedPhone.slice(-10);
          
          const formats = [
            last10Digits,
            `52${last10Digits}`,
            `+52${last10Digits}`,
            `521${last10Digits}`,
            `+521${last10Digits}`,
            cleanedPhone,
            `+${cleanedPhone}`
          ];
          
          const uniqueFormats = Array.from(new Set(formats.filter(f => f.length > 0)));
          const orFilterMobile = uniqueFormats.map(f => `mobile_phone.eq.${f}`).join(',');
          
          // Buscar directamente en users (mobile_phone)
          const { data: usersData } = await supabase
            .from('users')
            .select('id')
            .or(orFilterMobile)
            .limit(1);

          const userId = usersData && usersData.length > 0 ? usersData[0].id : null;

          if (userId) {
            // Estudiante encontrado. Obtener o crear la conversación.
            let { data: conversation } = await supabase
              .from('internal_meta_conversations')
              .select('id')
              .eq('student_id', userId)
              .maybeSingle();

            if (!conversation) {
              const { data: newConv, error: newConvErr } = await supabase
                .from('internal_meta_conversations')
                .insert({
                  student_id: userId,
                  last_message: bodyText,
                  last_message_date: new Date().toISOString(),
                  unread_count: 1
                })
                .select('id')
                .single();
              conversation = newConv;
              if (newConvErr) throw newConvErr;
            } else {
              // Incrementar contador y actualizar último mensaje
              await supabase
                .from('internal_meta_conversations')
                .update({
                  last_message: bodyText,
                  last_message_date: new Date().toISOString(),
                  unread_count: 1 // o incrementar en DB/Trigger
                })
                .eq('id', conversation.id);
            }

            // Insertar el mensaje en el historial
            await supabase.from('internal_meta_chats').insert({
              conversation_id: conversation.id,
              sender_type: 'student',
              sender_name: senderName,
              message_content: bodyText,
              whatsapp_message_id: messageId,
              status: 'read'
            });

            console.log(`✅ Mensaje enrutado con éxito a la conversación del estudiante ID: ${userId}`);
          } else {
            console.warn(`⚠️ Teléfono no registrado en la base de datos: ${cleanedPhone}`);
          }
        }

        // B. CASO: ACTUALIZACIÓN DE ESTADO (Doble check, entregado, leído)
        if (change?.statuses && change.statuses.length > 0) {
          const statusUpdate = change.statuses[0];
          const messageId = statusUpdate.id;
          const status = statusUpdate.status; // 'delivered', 'read', 'failed'

          console.log(`⚡ Estado de WhatsApp actualizado para ${messageId}: ${status}`);

          await supabase
            .from('internal_meta_chats')
            .update({ status: status })
            .eq('whatsapp_message_id', messageId);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      // 3. FLUJO SALIENTE

      // A. Caso Outbound Directo (Llamada HTTP desde Angular/Cliente)
      if (payload.phone || (payload.messaging_product && payload.to)) {
        let to: string;
        let metaPayload: Record<string, unknown>;

        if (payload.messaging_product && payload.to) {
          to = payload.to;
          metaPayload = payload;
          console.log(`📱 [Directo] Formato C (Meta API directo): destinatario ${to}`);
        } else if (payload.phone && payload.template) {
          to = payload.phone;
          metaPayload = {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: payload.template,
          };
          console.log(`📱 [Directo] Formato B (template): destinatario ${to}`);
        } else if (payload.phone && payload.message) {
          to = payload.phone;
          metaPayload = {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: payload.message },
          };
          console.log(`📱 [Directo] Formato A (texto): destinatario ${to}`);
        } else {
          return new Response(
            JSON.stringify({ error: "Payload inválido. Envía { phone, message } o { phone, template } o la estructura completa de Meta API." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cleanedPhone = to.replace(/\D/g, '');
        if (metaPayload.to) {
          metaPayload.to = cleanedPhone;
        }

        const endpoint = `https://graph.facebook.com/v19.0/${META_PHONE_NUMBER_ID}/messages`;
        console.log(`🚀 Llamando a Meta Cloud API (Directo): ${endpoint}`);

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${META_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metaPayload),
        });

        const result = await resp.json();
        console.log(`📊 Meta API response (${resp.status}):`, JSON.stringify(result));

        if (!resp.ok) {
          return new Response(
            JSON.stringify({ error: result }),
            { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: result }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // B. Caso Outbound por Trigger (Desde la Base de Datos)
      const record = payload.record || payload;

      if (record && record.sender_type === 'professional' && record.status === 'pending') {
        const conversationId = record.conversation_id;
        const messageContent = record.message_content;

        // A. Obtener el student_id de la conversación
        const { data: conv } = await supabase
          .from('internal_meta_conversations')
          .select('student_id')
          .eq('id', conversationId)
          .single();

        if (conv) {
          const studentId = conv.student_id;

          // B. Obtener teléfono del estudiante directamente de users (mobile_phone)
          const { data: user } = await supabase
            .from('users')
            .select('mobile_phone')
            .eq('id', studentId)
            .single();

          let phone = user?.mobile_phone;

          if (phone) {
            // Limpiar el teléfono para dejar solo dígitos
            const cleanedPhone = phone.replace(/\D/g, '');
            console.log(`✉️ Enviando WhatsApp saliente (Trigger) a: ${cleanedPhone}...`);

            // Preparar el cuerpo de la petición según si es mensaje de texto o plantilla
            let bodyPayload: any;
            if (messageContent.startsWith("TEMPLATE:")) {
              const parts = messageContent.replace("TEMPLATE:", "").split("|");
              const templateName = parts[0];
              const params = parts.slice(1);
              bodyPayload = {
                messaging_product: "whatsapp",
                to: cleanedPhone,
                type: "template",
                template: {
                  name: templateName,
                  language: { code: "es_MX" },
                  components: params.length > 0 ? [
                    {
                      type: "body",
                      parameters: params.map(p => ({ type: "text", text: p }))
                    }
                  ] : []
                }
              };
            } else {
              bodyPayload = {
                messaging_product: "whatsapp",
                to: cleanedPhone,
                type: "text",
                text: { body: messageContent }
              };
            }

            // Realizar llamada HTTP a Meta Cloud API v19.0
            const metaResponse = await fetch(`https://graph.facebook.com/v19.0/${META_PHONE_NUMBER_ID}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(bodyPayload)
            });

            const metaResult = await metaResponse.json();

            if (metaResponse.ok && metaResult.messages?.[0]?.id) {
              const waMessageId = metaResult.messages[0].id;
              console.log(`✅ WhatsApp enviado con éxito a Meta (Trigger). Message ID: ${waMessageId}`);

              // Actualizar el estado en base de datos
              await supabase
                .from('internal_meta_chats')
                .update({
                  whatsapp_message_id: waMessageId,
                  status: 'sent'
                })
                .eq('id', record.id);

              // Actualizar cabecera de conversación
              await supabase
                .from('internal_meta_conversations')
                .update({
                  last_message: messageContent.startsWith("TEMPLATE:") ? `[Plantilla: ${messageContent.replace("TEMPLATE:", "").split("|")[0]}]` : messageContent,
                  last_message_date: new Date().toISOString()
                })
                .eq('id', conversationId);

            } else {
              const errMsg = metaResult.error?.message || 'Error desconocido al invocar la API de Meta';
              console.error(`❌ Fallo al enviar mensaje vía Meta API (Trigger):`, metaResult);

              await supabase
                .from('internal_meta_chats')
                .update({
                  status: 'failed',
                  error_message: errMsg
                })
                .eq('id', record.id);
            }
          } else {
            console.error(`❌ El estudiante ${studentId} no tiene teléfono registrado.`);
            await supabase
              .from('internal_meta_chats')
              .update({
                status: 'failed',
                error_message: 'Estudiante no cuenta con teléfono registrado'
              })
              .eq('id', record.id);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });

    } catch (err: any) {
      console.error('❌ Error fatal en Edge Function meta-whatsapp:', err);
      return new Response(JSON.stringify({ error: err.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
