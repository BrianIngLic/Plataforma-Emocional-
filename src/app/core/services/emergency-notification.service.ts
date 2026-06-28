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
        const { data: subs, error: subsError } = await this.supabase
          .from('web_push_subscriptions')
          .select('*')
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
}
