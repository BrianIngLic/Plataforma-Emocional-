import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { CryptoService } from './crypto.service';
import { AuthService } from './auth.service';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private supabaseService = inject(SupabaseService);
  private cryptoService = inject(CryptoService);
  private authService = inject(AuthService);

  private messagesSignal = signal<ChatMessage[]>([]);
  public messages = this.messagesSignal.asReadonly();

  private isTypingSignal = signal<boolean>(false);
  public isTyping = this.isTypingSignal.asReadonly();

  private activeChatId: string | null = null;

  constructor() {
    // Al instanciar, intentamos recuperar el chat activo de Supabase
    setTimeout(() => this.initChat(), 500); 
  }

  async initChat() {
    const user = this.authService.currentUser();
    if (!user) return;

    // Buscar si hay un chat activo hoy
    const { data: chats } = await this.supabaseService.supabase
      .from('chats')
      .select('id')
      .eq('student_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (chats && chats.length > 0) {
      this.activeChatId = chats[0].id;
      await this.loadMessages();
    } else {
      // Crear nuevo chat
      const { data: newChat } = await this.supabaseService.supabase
        .from('chats')
        .insert({
          student_id: user.id,
          title: this.cryptoService.encrypt('Sesión del ' + new Date().toLocaleDateString())
        })
        .select()
        .single();
        
      if (newChat) {
        this.activeChatId = newChat.id;
        // Mensaje de bienvenida local (no hace falta guardarlo en DB)
        this.messagesSignal.set([{
          id: 'welcome',
          role: 'assistant',
          content: '¡Hola! Soy EmolA, tu asistente emocional. ¿Cómo te sientes hoy?',
          timestamp: new Date()
        }]);
      }
    }
  }

  private async loadMessages() {
    if (!this.activeChatId) return;

    const { data } = await this.supabaseService.supabase
      .from('messages')
      .select('*')
      .eq('chat_id', this.activeChatId)
      .order('timestamp', { ascending: true });

    if (data) {
      const msgs: ChatMessage[] = data.map(row => ({
        id: row.id,
        role: row.sender_type as 'user' | 'assistant',
        content: this.cryptoService.decrypt(row.content),
        timestamp: new Date(row.timestamp)
      }));
      
      if (msgs.length === 0) {
        msgs.push({
          id: 'welcome',
          role: 'assistant',
          content: '¡Hola! Soy EmolA, tu asistente emocional. ¿Cómo te sientes hoy?',
          timestamp: new Date()
        });
      }
      this.messagesSignal.set(msgs);
    }
  }

  async startNewChat() {
    const user = this.authService.currentUser();
    if (!user) return;
    
    // Si el chat actual está vacío, no creamos otro.
    const currentMsgs = this.messagesSignal();
    if (currentMsgs.length <= 1) return;

    // Crear nuevo chat
    const { data: newChat } = await this.supabaseService.supabase
      .from('chats')
      .insert({
        student_id: user.id,
        title: this.cryptoService.encrypt('Nueva Conversación')
      })
      .select()
      .single();
      
    if (newChat) {
      this.activeChatId = newChat.id;
      this.messagesSignal.set([{
        id: 'welcome',
        role: 'assistant',
        content: '¡Hola! Soy EmolA, tu asistente emocional. ¿Cómo te sientes hoy?',
        timestamp: new Date()
      }]);
    }
  }

  async getChatHistory() {
    const user = this.authService.currentUser();
    if (!user) return [];
    
    const { data } = await this.supabaseService.supabase
      .from('chats')
      .select('id, title, created_at')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (data) {
      return data.map(c => {
        let decTitle = 'Chat sin título';
        try { decTitle = this.cryptoService.decrypt(c.title); } catch(e){}
        return { ...c, title: decTitle };
      });
    }
    return [];
  }

  async loadSpecificChat(chatId: string) {
    this.activeChatId = chatId;
    await this.loadMessages();
  }

  async sendMessage(content: string) {
    if (!content.trim() || !this.activeChatId) return;

    // 1. Mostrar mensaje del usuario inmediatamente
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };
    this.messagesSignal.update(msgs => [...msgs, userMsg]);
    this.isTypingSignal.set(true);

    // Guardar en Supabase (cifrado E2EE)
    await this.supabaseService.supabase.from('messages').insert({
      chat_id: this.activeChatId,
      sender_type: 'user',
      content: this.cryptoService.encrypt(content.trim())
    });

    // 2. Simular retraso de red
    await this.delay(800 + Math.random() * 1000);

    // 3. Simular respuesta del LLM
    const aiResponse = this.getMockResponse(content);

    // Guardar respuesta de IA en Supabase (cifrado E2EE)
    const { data: aiData } = await this.supabaseService.supabase.from('messages').insert({
      chat_id: this.activeChatId,
      sender_type: 'assistant',
      content: this.cryptoService.encrypt(aiResponse)
    }).select().single();

    const aiMsgId = aiData ? aiData.id : Math.random().toString(36).substring(2, 9);
    
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };
    
    this.messagesSignal.update(msgs => [...msgs, aiMsg]);
    this.isTypingSignal.set(false);

    // 4. Stream visual en la UI
    this.streamMockResponse(aiMsgId, aiResponse);
  }

  private async streamMockResponse(messageId: string, fullText: string) {
    const chunks = fullText.split(' ');
    let currentText = '';

    for (let i = 0; i < chunks.length; i++) {
      currentText += (i === 0 ? '' : ' ') + chunks[i];
      this.messagesSignal.update(msgs => 
        msgs.map(m => m.id === messageId ? { ...m, content: currentText } : m)
      );
      await this.delay(30 + Math.random() * 60);
    }

    this.messagesSignal.update(msgs => 
      msgs.map(m => m.id === messageId ? { ...m, isStreaming: false } : m)
    );
  }

  private getMockResponse(input: string): string {
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes('estrés') || lowerInput.includes('ansios')) {
      return 'Entiendo, la ansiedad es algo que muchas personas enfrentan. ¿Hay algo específico que la detone?';
    }
    return `He leído lo que me comentas sobre "${input.substring(0, 20)}...". Es válido sentirse así. ¿Qué más pasó?`;
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
