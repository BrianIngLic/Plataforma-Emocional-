import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// ── Secrets ───────────────────────────────────────────────────────────────────
const VERIFY_TOKEN    = Deno.env.get("META_VERIFY_TOKEN")    ?? "mySuperSecretVerifyToken123";
const ACCESS_TOKEN    = Deno.env.get("META_ACCESS_TOKEN");
// PHONE_NUMBER_ID: obténlo en Meta Developer → WhatsApp → API Setup
const PHONE_NUMBER_ID = Deno.env.get("META_PHONE_NUMBER_ID");

// ── CORS helper ───────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  const url = new URL(req.url);

  // Pre‑flight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1️⃣  Webhook verification (GET) – Meta Cloud API
  // ──────────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const mode      = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    const token     = url.searchParams.get("hub.verify_token");

    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response(
      JSON.stringify({ error: "Invalid verification request" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2️⃣  Send message (POST)
  // ──────────────────────────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validar secretos requeridos
  if (!ACCESS_TOKEN) {
    console.error("❌ META_ACCESS_TOKEN no configurado en los secretos de Supabase.");
    return new Response(
      JSON.stringify({ error: "Missing Meta access token. Set META_ACCESS_TOKEN in Supabase secrets." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!PHONE_NUMBER_ID) {
    console.error("❌ META_PHONE_NUMBER_ID no configurado en los secretos de Supabase.");
    return new Response(
      JSON.stringify({ error: "Missing Phone Number ID. Set META_PHONE_NUMBER_ID in Supabase secrets." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    console.log("📨 Payload recibido:", JSON.stringify(body));

    // ── Normalizar payload ──────────────────────────────────────────────────
    // Acepta dos formatos:
    //   A) { phone, message }            → texto libre
    //   B) { phone, template }           → plantilla de Meta
    //   C) { messaging_product, to, ... } → estructura completa de Meta API (enviado desde Angular)
    let to: string;
    let metaPayload: Record<string, unknown>;

    if (body.messaging_product && body.to) {
      // Formato C: el servicio Angular ya construyó la estructura completa
      to = body.to;
      metaPayload = body;
      console.log(`📱 Formato C (Meta API directo): destinatario ${to}`);
    } else if (body.phone && body.template) {
      // Formato B: plantilla
      to = body.phone;
      metaPayload = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: body.template,
      };
      console.log(`📱 Formato B (template): destinatario ${to}`);
    } else if (body.phone && body.message) {
      // Formato A: texto libre
      to = body.phone;
      metaPayload = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: body.message },
      };
      console.log(`📱 Formato A (texto): destinatario ${to}`);
    } else {
      return new Response(
        JSON.stringify({ error: "Payload inválido. Envía { phone, message } o { phone, template } o la estructura completa de Meta API." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Llamada a la Meta Cloud API ─────────────────────────────────────────
    // IMPORTANTE: el endpoint usa PHONE_NUMBER_ID (no el número del destinatario)
    const endpoint = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
    console.log(`🚀 Llamando a Meta Cloud API: ${endpoint}`);

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
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

  } catch (e: any) {
    console.error("❌ Error inesperado:", e.message);
    return new Response(
      JSON.stringify({ error: e.message || "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
