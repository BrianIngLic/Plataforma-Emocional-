import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { InternalChatService, Conversation, WhatsAppMessage } from '../../../core/services/internal-chat.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-command-center-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './command-center-chat.component.html',
  styleUrls: ['./command-center-chat.component.scss']
})
export class CommandCenterChatComponent implements OnInit, OnDestroy {
  private chatService = inject(InternalChatService);
  private authService = inject(AuthService);

  @ViewChild('messagesViewport') messagesViewport!: ElementRef;

  conversations = signal<Conversation[]>([]);
  selectedChat = signal<Conversation | null>(null);
  activeMessages = signal<WhatsAppMessage[]>([]);
  
  activeFilter = signal<'all' | 'urgent'>('all');
  searchQuery = signal<string>('');
  newMessageText = '';

  // Selector de plantillas oficiales (para rebasar ventana de 24h)
  showTemplateSelector = signal<boolean>(false);
  templates = [
    { name: 'appointment_reminder', label: 'Recordatorio de Cita', text: 'TEMPLATE:appointment_reminder|10:00 AM' },
    { name: 'clinical_follow_up', label: 'Seguimiento Clínico', text: 'TEMPLATE:clinical_follow_up' },
    { name: 'administrative_alert', label: 'Aviso Administrativo', text: 'TEMPLATE:administrative_alert' }
  ];

  filteredConversations = computed(() => {
    let list = this.conversations();
    const query = this.searchQuery().trim().toLowerCase();
    
    if (this.activeFilter() === 'urgent') {
      list = list.filter(c => c.urgency_score >= 0.7);
    }
    
    if (query) {
      list = list.filter(c => c.student_name.toLowerCase().includes(query));
    }
    
    return list;
  });

  private activeSubscription: any;

  async ngOnInit() {
    await this.loadConversations();
  }

  ngOnDestroy() {
    this.unsubscribeFromChat();
  }

  async loadConversations() {
    const list = await this.chatService.getConversations();
    this.conversations.set(list);
  }

  setFilter(filter: 'all' | 'urgent') {
    this.activeFilter.set(filter);
  }

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  async selectConversation(chat: Conversation) {
    this.selectedChat.set(chat);
    this.unsubscribeFromChat();

    // Cargar mensajes iniciales
    const msgs = await this.chatService.getMessages(chat.id);
    this.activeMessages.set(msgs);
    this.scrollToBottom();

    // Marcar como leída la conversación
    if (chat.unread_count > 0) {
      await this.chatService.markAsRead(chat.id);
      this.conversations.update(list => 
        list.map(c => c.id === chat.id ? { ...c, unread_count: 0 } : c)
      );
    }

    // Suscribirse a cambios en tiempo real
    this.activeSubscription = this.chatService.subscribeToMessages(chat.id, (newMsg) => {
      this.activeMessages.update(msgs => {
        const index = msgs.findIndex(m => m.id === newMsg.id || (m.whatsapp_message_id && m.whatsapp_message_id === newMsg.whatsapp_message_id));
        if (index > -1) {
          const updated = [...msgs];
          updated[index] = newMsg;
          return updated;
        } else {
          return [...msgs, newMsg];
        }
      });
      this.scrollToBottom();
    });
  }

  unsubscribeFromChat() {
    if (this.activeSubscription) {
      this.activeSubscription.unsubscribe();
      this.activeSubscription = null;
    }
  }

  selectTemplate(templateText: string) {
    this.newMessageText = templateText;
    this.showTemplateSelector.set(false);
  }

  async sendMessage() {
    if (!this.newMessageText.trim() || !this.selectedChat()) return;

    const chat = this.selectedChat()!;
    const currentUser = this.authService.currentUser();
    const senderName = currentUser ? currentUser.name : 'Personal Clínico';
    const text = this.newMessageText.trim();
    this.newMessageText = '';

    // Añadir mensaje optimista provisional a la vista
    const tempMessage: WhatsAppMessage = {
      id: crypto.randomUUID(),
      conversation_id: chat.id,
      sender_type: 'professional',
      sender_name: senderName,
      message_content: text,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    this.activeMessages.update(msgs => [...msgs, tempMessage]);
    this.scrollToBottom();

    // Enviar a Supabase (dispara trigger hacia Edge Function)
    const result = await this.chatService.sendMessage(chat.id, text, senderName);
    
    // Si fue exitoso se actualizará por Realtime, de lo contrario reportamos fallo
    if (!result) {
      this.activeMessages.update(msgs => 
        msgs.map(m => m.id === tempMessage.id ? { ...m, status: 'failed' } : m)
      );
    }
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.messagesViewport) {
        this.messagesViewport.nativeElement.scrollTop = this.messagesViewport.nativeElement.scrollHeight;
      }
    }, 100);
  }
}
