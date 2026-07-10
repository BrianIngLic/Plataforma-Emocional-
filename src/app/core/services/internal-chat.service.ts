import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  sender_type: 'professional' | 'student';
  sender_name: string;
  message_content: string;
  created_at: string;
  whatsapp_message_id?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  error_message?: string;
}

export interface Conversation {
  id: string;
  student_id: string;
  student_name: string;
  student_phone: string;   // número E.164 del estudiante (para WhatsApp)
  avatar_url: string;
  urgency_score: number;
  last_message: string;
  last_message_date: string;
  unread_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class InternalChatService {
  private supabase = inject(SupabaseService).supabase;

  async getConversations(): Promise<Conversation[]> {
    const { data, error } = await this.supabase
      .from('internal_meta_conversations')
      .select('id, student_id, urgency_score, last_message, last_message_date, unread_count')
      .order('last_message_date', { ascending: false });

    if (error) {
      console.error('Error fetching internal conversations:', error);
      return [];
    }

    if (!data) return [];

    return data.map((item: any) => {
      const studentProfile = item.student?.profiles;
      const firstName = studentProfile?.first_name || '';
      const lastName = studentProfile?.last_name || '';
      const avatarUrl = studentProfile?.avatar_url || '';
      const phone = item.student?.mobile_phone || '';

      return {
        id: item.id,
        student_id: item.student_id,
        student_name: `${firstName} ${lastName}`.trim() || 'Estudiante',
        student_phone: phone,
        avatar_url: avatarUrl,
        urgency_score: Number(item.urgency_score || 0),
        last_message: item.last_message || '',
        last_message_date: item.last_message_date,
        unread_count: item.unread_count || 0
      };
    });
  }

  async getMessages(conversationId: string): Promise<WhatsAppMessage[]> {
    const { data, error } = await this.supabase
      .from('internal_meta_chats')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return [];
    }

    return (data as WhatsAppMessage[]) || [];
  }

  /**
   * Guarda el mensaje en BD y lo envía via WhatsApp si hay teléfono disponible.
   * Retorna el mensaje guardado (con status actualizado) o null si falló el INSERT.
   */
  async sendMessage(
    conversationId: string,
    content: string,
    senderName: string,
    studentPhone?: string
  ): Promise<WhatsAppMessage | null> {
    // 1️⃣ INSERT optimista en BD con status 'pending'
    const msgPayload = {
      conversation_id: conversationId,
      sender_type: 'professional',
      sender_name: senderName,
      message_content: content,
      status: 'pending'
    };

    const { data, error } = await this.supabase
      .from('internal_meta_chats')
      .insert(msgPayload)
      .select()
      .single();

    if (error || !data) {
      console.error('Error saving message to DB:', error);
      return null;
    }

    const savedMsg = data as WhatsAppMessage;

    // 2️⃣ Actualizar el resumen de la conversación (last_message / last_message_date)
    await this.supabase
      .from('internal_meta_conversations')
      .update({
        last_message: content.substring(0, 100),
        last_message_date: new Date().toISOString()
      })
      .eq('id', conversationId);

    // 3️⃣ Enviar via Meta Cloud API si hay teléfono del destinatario
    if (studentPhone && studentPhone.trim().length > 0) {
      try {
        console.log(`📱 Enviando mensaje WhatsApp a ${studentPhone} via Edge Function...`);

        const { data: fnResult, error: fnError } = await this.supabase.functions.invoke(
          'meta-whatsapp-outbound',
          {
            method: 'POST',
            body: {
              phone: studentPhone,
              message: content
            }
          }
        );

        if (fnError) {
          console.error('❌ Edge Function error:', fnError);
          // Marcar mensaje como fallido en BD
          await this.supabase
            .from('internal_meta_chats')
            .update({ status: 'failed', error_message: fnError.message || 'Edge Function error' })
            .eq('id', savedMsg.id);
          return { ...savedMsg, status: 'failed', error_message: fnError.message };
        }

        // Extraer wamid (WhatsApp Message ID) de la respuesta de Meta
        const wamid = fnResult?.data?.messages?.[0]?.id || null;
        console.log(`✅ Mensaje enviado. WAMID: ${wamid}`, fnResult);

        // Actualizar status y wamid en BD
        const { data: updatedMsg } = await this.supabase
          .from('internal_meta_chats')
          .update({
            status: 'sent',
            whatsapp_message_id: wamid
          })
          .eq('id', savedMsg.id)
          .select()
          .single();

        return (updatedMsg as WhatsAppMessage) ?? { ...savedMsg, status: 'sent', whatsapp_message_id: wamid };

      } catch (e: any) {
        console.error('❌ Error inesperado enviando WhatsApp:', e);
        await this.supabase
          .from('internal_meta_chats')
          .update({ status: 'failed', error_message: e.message })
          .eq('id', savedMsg.id);
        return { ...savedMsg, status: 'failed', error_message: e.message };
      }
    } else {
      // Sin teléfono registrado: dejar el mensaje guardado en BD pero informar
      console.warn('⚠️ El estudiante no tiene teléfono registrado. Mensaje guardado en BD pero no enviado por WhatsApp.');
      return savedMsg;
    }
  }

  async markAsRead(conversationId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('internal_meta_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);

    if (error) {
      console.error('Error marking conversation as read:', error);
      return false;
    }
    return true;
  }

  subscribeToMessages(conversationId: string, callback: (newMsg: WhatsAppMessage) => void) {
    return this.supabase
      .channel(`chat-channel-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_meta_chats',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            callback(payload.new as WhatsAppMessage);
          } else if (payload.eventType === 'UPDATE') {
            callback(payload.new as WhatsAppMessage);
          }
        }
      )
      .subscribe();
  }
}
