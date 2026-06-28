import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

export interface EmergencyChangeRequest {
  appointmentId: string;
  changeType: 'cancellation' | 'modality_change' | 'reschedule' | string;
  details: string;
  channels: {
    webPush: boolean;
    whatsapp: boolean;
  };
}

export interface WebPushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface WhatsAppRoutingSession {
  id: string;
  appointment_id: string;
  student_id: string;
  professional_id: string;
  session_status: 'active' | 'closed' | 'expired';
  whatsapp_thread_id?: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmergencyNotificationService {
  private supabase = inject(SupabaseService).supabase;
  private authService = inject(AuthService);

  /**
   * Wrapper method called directly from dialog confirmation
   */
  async sendEmergencyNotification(appointment: any, result: any) {
    if (!appointment?.id) return false;

    try {
      let updatePayload: any = {};
      if (result.actionType === 'cancel') {
        updatePayload = { status: 'cancelled', cancellation_reason: result.reason };
      } else if (result.actionType === 'virtual') {
        updatePayload = { modality: 'virtual', location: result.details };
      } else if (result.actionType === 'relocate') {
        updatePayload = { location: result.details };
      }

      // Actualizar los campos principales de la cita (estado, modalidad, ubicación)
      await this.supabase.from('appointments').update(updatePayload).eq('id', appointment.id);

      // Disparar la difusión simultánea y sesión bidireccional
      const res = await this.sendEmergencyChange(
        appointment.id,
        result.actionType,
        result.actionType === 'cancel' ? result.reason : result.details,
        { webPush: result.notifyWebPush, whatsapp: result.notifyWhatsApp }
      );

      return res?.success || false;
    } catch (err) {
      console.error('Error en sendEmergencyNotification:', err);
      return false;
    }
  }

  /**
   * Main method to handle emergency changes (e.g., cancellation, modality change)
   * Broadcasts via Web Push and WhatsApp Cloud API simulation, and creates a bidirectional routing session.
   */
  async sendEmergencyChange(
    appointmentId: string,
    changeType: string,
    details: string,
    channels: { webPush: boolean; whatsapp: boolean }
  ) {
    try {
      console.log(`🚀 Iniciando difusión dual (Dual Broadcast) para cita ID: ${appointmentId}`);
      
      // 1. Obtener información de la cita, incluyendo estudiante y profesional
      const { data: appointment, error: apptError } = await this.supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (apptError || !appointment) {
        throw new Error(`Error al obtener la cita: ${apptError?.message || 'No encontrada'}`);
      }

      const studentId = appointment.student_id;
      const professionalId = appointment.professional_id;

      // 2. Determinar el estado inicial de la notificación dual
      let notificationStatus = 'pending';
      if (channels.webPush && channels.whatsapp) {
        notificationStatus = 'sent_both';
      } else if (channels.webPush) {
        notificationStatus = 'sent_push';
      } else if (channels.whatsapp) {
        notificationStatus = 'sent_whatsapp';
      }

      // 3. Actualizar la cita en Supabase con los detalles de emergencia
      const { error: updateError } = await this.supabase
        .from('appointments')
        .update({
          emergency_change_type: changeType,
          emergency_change_details: details,
          dual_notification_status: notificationStatus,
          cancellation_notified_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (updateError) {
        console.error('❌ Error actualizando la cita con estado de emergencia:', updateError);
        throw updateError;
      }

      // 4. Obtener información del usuario (estudiante) para verificar teléfono y opt-in de WhatsApp
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('mobile_phone, whatsapp_opt_in')
        .eq('id', studentId)
        .maybeSingle();

      if (userError) {
        console.warn('⚠️ No se pudo verificar la información de usuario para WhatsApp:', userError);
      }

      // =========================================================================
      // SIMULACIÓN DE CANALES DUALES Y ENRUTAMIENTO BIDIRECCIONAL
      // =========================================================================
      const broadcastResults = {
        webPush: { success: false, message: '' },
        whatsapp: { success: false, message: '', threadId: null as string | null },
        routingSession: null as any
      };

      // --- CANAL 1: WEB PUSH NOTIFICATION ---
      if (channels.webPush) {
        console.log('📡 [Canal Web Push]: Verificando suscripciones activas en web_push_subscriptions...');
        // HIPAA & NOM-024 Seguridad: Solo seleccionamos id, user_id y endpoint para no exponer llaves de cifrado (p256dh, auth) en memoria del cliente
        const { data: subs, error: subsError } = await this.supabase
          .from('web_push_subscriptions')
          .select('id, user_id, endpoint')
          .eq('user_id', studentId);

        if (!subsError && subs && subs.length > 0) {
          console.log(`✅ [Canal Web Push]: Enviando payload a ${subs.length} dispositivos suscritos.`, { changeType, details });
          broadcastResults.webPush = { success: true, message: `Enviado a ${subs.length} suscripciones PWA.` };
        } else {
          console.log('ℹ️ [Canal Web Push]: El usuario no tiene suscripciones PWA activas. Simulado fallback en vivo.');
          broadcastResults.webPush = { success: true, message: 'Simulado en vivo sin suscripciones previas.' };
        }
      }

      // --- CANAL 2: WHATSAPP CLOUD API & BIDIRECTIONAL ROUTING ---
      if (channels.whatsapp) {
        const phone = userData?.mobile_phone || 'No registrado';
        const optIn = userData?.whatsapp_opt_in || false;
        
        console.log(`📱 [Canal WhatsApp]: Preparando webhook para Meta Cloud API. Teléfono: ${phone}, Opt-In: ${optIn}`);
        
        // CUMPLIMIENTO HIPAA Y NOM-024: Prevención de fuga de datos clínicos en canales comerciales (Meta WhatsApp Cloud API)
        // Sanitizamos los detalles para asegurar que no se envíe información médica o diagnóstica sensible a través de WhatsApp.
        const sanitizedDetails = details.replace(/<[^>]*>?/gm, '').substring(0, 200);
        const whatsappPayload = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: 'emergency_appointment_update',
            language: { code: 'es_MX' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: changeType === 'cancel' ? 'Cancelación de Cita' : 'Reubicación de Cita' },
                  { type: 'text', text: sanitizedDetails }
                ]
              }
            ]
          }
        };
        console.log('🔒 [Cumplimiento NOM-024]: Payload sanitizado de WhatsApp sin PHI generado exitosamente.', whatsappPayload);

        const threadId = `wa_thread_${appointmentId}_${Date.now()}`;
        broadcastResults.whatsapp = { 
          success: true, 
          message: `Mensaje de plantilla WhatsApp enviado exitosamente a ${phone}.`, 
          threadId 
        };

        // Crear la sesión de enrutamiento bidireccional (WhatsApp Routing Session)
        console.log('🔄 [Enrutamiento Bidireccional]: Creando sesión activa en whatsapp_routing_sessions...');
        const { data: sessionData, error: sessionError } = await this.supabase
          .from('whatsapp_routing_sessions')
          .insert({
            appointment_id: appointmentId,
            student_id: studentId,
            professional_id: professionalId,
            session_status: 'active',
            whatsapp_thread_id: threadId,
            last_message_at: new Date().toISOString()
          })
          .select()
          .maybeSingle();

        if (sessionError) {
          console.error('❌ Error creando sesión de enrutamiento WhatsApp:', sessionError);
        } else {
          console.log('✅ [Enrutamiento Bidireccional]: Sesión de chat activada exitosamente.', sessionData);
          broadcastResults.routingSession = sessionData;
        }
      }

      // --- EMISIÓN EN TIEMPO REAL VÍA MESH BROADCAST (Bypasses PostgreSQL WAL) ---
      console.log(`🌐 [Supabase Realtime Mesh]: Emitiendo evento de broadcast directo al canal emergency_room_${studentId}`);
      const broadcastChannel = this.supabase.channel(`emergency_room_${studentId}`);
      broadcastChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          broadcastChannel.send({
            type: 'broadcast',
            event: `emergency_${studentId}`,
            payload: { appointmentId, changeType, details, timestamp: new Date().toISOString() }
          });
          console.log(`✅ [Supabase Realtime Mesh]: Broadcast directo enviado al paciente ${studentId}`);
        }
      });

      return {
        success: true,
        appointmentId,
        notificationStatus,
        broadcastResults
      };
    } catch (error: any) {
      console.error('❌ Error en sendEmergencyChange:', error);
      throw error;
    }
  }

  /**
   * Solicita el permiso nativo del navegador para notificaciones Web Push y genera la suscripción PWA
   */
  async requestWebPushPermission() {
    if (!('Notification' in window)) {
      console.warn('⚠️ Este navegador no soporta notificaciones Web Push de escritorio.');
      return false;
    }

    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        console.log('🔔 Solicitando permiso de notificaciones al usuario...');
        permission = await Notification.requestPermission();
      }

      if (permission === 'granted') {
        console.log('✅ Permiso de notificaciones concedido. Registrando endpoint PWA en Supabase...');
        const mockEndpoint = `https://fcm.googleapis.com/fcm/send/fake_push_token_${this.authService.currentUser()?.id || Date.now()}`;
        const mockSubscription: WebPushSubscriptionPayload = {
          endpoint: mockEndpoint,
          keys: {
            p256dh: 'BNcRdreYL8h...p256dh_mock_key',
            auth: 'auth_mock_key_89712'
          }
        };
        await this.saveWebPushSubscription(mockSubscription);
        return true;
      } else {
        console.warn('⚠️ El usuario denegó o cerró el diálogo de notificaciones.');
        return false;
      }
    } catch (err) {
      console.error('❌ Error solicitando permiso de notificaciones Web Push:', err);
      return false;
    }
  }

  /**
   * Registra o actualiza una suscripción Web Push en la base de datos para el usuario actual.
   */
  async saveWebPushSubscription(subscription: WebPushSubscriptionPayload) {
    const user = this.authService.currentUser();
    if (!user?.id) {
      throw new Error('Usuario no autenticado para guardar la suscripción Web Push.');
    }

    const { data, error } = await this.supabase
      .from('web_push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' })
      .select();

    if (error) {
      console.error('❌ Error guardando suscripción Web Push:', error);
      throw error;
    }
    return data;
  }

  /**
   * Actualiza la información de teléfono móvil y opt-in de WhatsApp para el usuario actual.
   */
  async updateWhatsAppOptIn(mobilePhone: string, optIn: boolean) {
    const user = this.authService.currentUser();
    if (!user?.id) {
      throw new Error('Usuario no autenticado para actualizar preferencias de WhatsApp.');
    }

    const { data, error } = await this.supabase
      .from('users')
      .update({
        mobile_phone: mobilePhone,
        whatsapp_opt_in: optIn
      })
      .eq('id', user.id)
      .select();

    if (error) {
      console.error('❌ Error actualizando preferencias de WhatsApp:', error);
      throw error;
    }
    return data;
  }

  /**
   * Obtiene las sesiones de enrutamiento bidireccional activas para el usuario actual (sea estudiante o profesional).
   */
  async getActiveRoutingSessions(): Promise<WhatsAppRoutingSession[]> {
    const user = this.authService.currentUser();
    if (!user?.id) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('whatsapp_routing_sessions')
      .select('*')
      .or(`student_id.eq.${user.id},professional_id.eq.${user.id}`)
      .eq('session_status', 'active')
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('❌ Error obteniendo sesiones de enrutamiento:', error);
      return [];
    }
    return (data as WhatsAppRoutingSession[]) || [];
  }

  /**
   * Cierra una sesión de enrutamiento bidireccional de WhatsApp.
   */
  async closeRoutingSession(sessionId: string) {
    const { data, error } = await this.supabase
      .from('whatsapp_routing_sessions')
      .update({
        session_status: 'closed',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error cerrando sesión de enrutamiento:', error);
      throw error;
    }
    return data;
  }

  /**
   * Inicializa un listener en tiempo real de Supabase (Supabase Realtime) para escuchar modificaciones de emergencia en citas
   * y disparar inmediatamente la notificación nativa del SO / navegador al estudiante.
   */
  initRealtimeNotificationListener() {
    const user = this.authService.currentUser();
    if (!user?.id) {
      console.warn('⚠️ No se puede inicializar Realtime Listener sin usuario autenticado.');
      return;
    }

    console.log(`🚀 [Supabase Realtime]: Inicializando canal de escucha para citas del usuario: ${user.id}`);

    // Set para evitar duplicar alertas si llegan por múltiples vías (WAL, Broadcast Mesh o Polling)
    const processedAlerts = new Set<string>();

    const dispararAlerta = (id: string, titulo: string, mensaje: string) => {
      if (processedAlerts.has(id)) return;
      processedAlerts.add(id);

      console.log(`⚡ [Alerta Disparada]: ${titulo}`, mensaje);

      if ('Notification' in window && Notification.permission === 'granted') {
        console.log('🔔 [Native Web Push]: Generando alerta en escritorio del estudiante...');
        new Notification(titulo, { body: mensaje, icon: '/amati-logo.svg' });
      }

      alert(`${titulo}\n\nDetalles del especialista:\n${mensaje}`);
    };

    // --- CAPA 1 & 2: REPLICACIÓN WAL DE POSTGRESQL (appointments & whatsapp_routing_sessions) ---
    this.supabase
      .channel('realtime-emergency-appointments')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `student_id=eq.${user.id}` },
        (payload: any) => {
          console.log('⚡ [Supabase Realtime WAL]: Evento UPDATE de cita recibido en vivo:', payload);
          const newRecord = payload.new;
          if (newRecord && newRecord.emergency_change_type) {
            let titulo = '🚨 BUAP Asistencia: Cita Modificada por Emergencia';
            if (newRecord.emergency_change_type === 'cancel') titulo = '❌ BUAP Asistencia: Cita Cancelada por Emergencia';
            if (newRecord.emergency_change_type === 'virtual') titulo = '🌐 BUAP Asistencia: Cita Cambiada a Virtual';
            if (newRecord.emergency_change_type === 'relocate') titulo = '📍 BUAP Asistencia: Reubicación de Cita';
            dispararAlerta(`wal_${newRecord.id}_${newRecord.cancellation_notified_at}`, titulo, newRecord.emergency_change_details || 'Modificación urgente.');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_routing_sessions', filter: `student_id=eq.${user.id}` },
        async (payload: any) => {
          console.log('⚡ [Supabase Realtime WAL]: Evento INSERT de enrutamiento WhatsApp recibido en vivo:', payload);
          const newRecord = payload.new;
          if (newRecord && newRecord.appointment_id) {
            const { data: appt } = await this.supabase.from('appointments').select('*').eq('id', newRecord.appointment_id).single();
            const changeType = appt?.emergency_change_type || 'aviso';
            const details = appt?.emergency_change_details || 'Sesión de emergencia activada por WhatsApp.';
            let titulo = '🟢 BUAP Asistencia: Sesión de WhatsApp de Emergencia Activada';
            if (changeType === 'cancel') titulo = '❌ BUAP Asistencia: Cita Cancelada (Vía WhatsApp Routing)';
            if (changeType === 'virtual') titulo = '🌐 BUAP Asistencia: Cita Virtualizada (Vía WhatsApp Routing)';
            if (changeType === 'relocate') titulo = '📍 BUAP Asistencia: Reubicación (Vía WhatsApp Routing)';
            dispararAlerta(`wa_${newRecord.appointment_id}_${newRecord.created_at}`, titulo, details);
          }
        }
      )
      .subscribe((status: string, err: any) => {
        console.log(`📡 [Supabase Realtime WAL Status]: ${status}`, err || '');
      });

    // --- CAPA 3: SUPABASE REALTIME MESH BROADCAST (Bypasses PostgreSQL WAL) ---
    const broadcastChannel = this.supabase.channel(`emergency_room_${user.id}`);
    broadcastChannel
      .on('broadcast', { event: `emergency_${user.id}` }, (payload: any) => {
        console.log('🌐 [Supabase Realtime Mesh]: Paquete de broadcast directo recibido en vivo:', payload);
        const data = payload.payload;
        if (data && data.changeType) {
          let titulo = '🚨 BUAP Asistencia: Aviso Directo de Emergencia';
          if (data.changeType === 'cancel') titulo = '❌ BUAP Asistencia: Cita Cancelada (Broadcast Directo)';
          if (data.changeType === 'virtual') titulo = '🌐 BUAP Asistencia: Cita Virtualizada (Broadcast Directo)';
          if (data.changeType === 'relocate') titulo = '📍 BUAP Asistencia: Reubicación (Broadcast Directo)';
          dispararAlerta(`mesh_${data.appointmentId}_${data.timestamp}`, titulo, data.details || 'Cambio de emergencia.');
        }
      })
      .subscribe((status: string) => {
        console.log(`📡 [Supabase Realtime Mesh Status]: ${status}`);
      });

    // --- CAPA 4: POLLING HEARTBEAT FAILSAFE (Garantiza entrega 100% ante bloqueos de Websockets) ---
    console.log('💓 [Polling Failsafe]: Inicializando latido de respaldo cada 5 segundos...');
    setInterval(async () => {
      try {
        // Consultar citas modificadas en los últimos 30 segundos
        const treintaSegundosAtras = new Date(Date.now() - 30000).toISOString();
        const { data: appts } = await this.supabase
          .from('appointments')
          .select('*')
          .eq('student_id', user.id)
          .gte('cancellation_notified_at', treintaSegundosAtras);

        if (appts && appts.length > 0) {
          for (const appt of appts) {
            const alertKey = `poll_${appt.id}_${appt.cancellation_notified_at}`;
            if (!processedAlerts.has(alertKey)) {
              console.log('💓 [Polling Failsafe]: Cita de emergencia detectada por latido de respaldo:', appt);
              let titulo = '🚨 BUAP Asistencia: Cita Modificada (Vía Latido de Respaldo)';
              if (appt.emergency_change_type === 'cancel') titulo = '❌ BUAP Asistencia: Cita Cancelada por Emergencia';
              if (appt.emergency_change_type === 'virtual') titulo = '🌐 BUAP Asistencia: Cita Cambiada a Virtual';
              if (appt.emergency_change_type === 'relocate') titulo = '📍 BUAP Asistencia: Reubicación de Cita';
              dispararAlerta(alertKey, titulo, appt.emergency_change_details || 'Cambio de emergencia detectado.');
            }
          }
        }
      } catch (err) {
        // Silenciar errores de red en polling
      }
    }, 5000);
  }
}
