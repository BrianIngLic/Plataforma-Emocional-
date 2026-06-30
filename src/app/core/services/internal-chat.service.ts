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
    // Consulta para obtener conversaciones uniendo los perfiles del estudiante
    const { data, error } = await this.supabase
      .from('internal_meta_conversations')
      .select(`
        id,
        student_id,
        urgency_score,
        last_message,
        last_message_date,
        unread_count,
        student:users!internal_meta_conversations_student_id_fkey(
          profiles(first_name, last_name, avatar_url)
        )
      `)
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

      return {
        id: item.id,
        student_id: item.student_id,
        student_name: `${firstName} ${lastName}`.trim() || 'Estudiante',
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

  async sendMessage(conversationId: string, content: string, senderName: string): Promise<WhatsAppMessage | null> {
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

    if (error) {
      console.error('Error sending message:', error);
      return null;
    }

    return data as WhatsAppMessage;
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
