import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
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
private route = inject(ActivatedRoute); private router = inject(Router);
  @ViewChild('messagesViewport') messagesViewport!: ElementRef;

  conversations = signal<Conversation[]>([]);
  selectedChat = signal<Conversation | null>(null);
  activeMessages = signal<WhatsAppMessage[]>([]);
  isSending = signal<boolean>(false);
  noPhoneWarning = signal<boolean>(false);

  activeFilter = signal<'all' | 'urgent'>('all');
  searchQuery = signal<string>('');
  newMessageText = '';

  // Selector de plantillas oficiales (para rebasar ventana de 24h)
  showTemplateSelector = signal<boolean>(false);
  templates = [
    { name: 'appointment_reminder', label: 'Recordatorio de Cita', text: 'Recordatorio: tienes una cita programada. Por favor confírmala o comunícate con nosotros.' },
    { name: 'clinical_follow_up', label: 'Seguimiento Clínico', text: '¿Cómo te has sentido desde nuestra última sesión? Estamos aquí para apoyarte.' },
    { name: 'administrative_alert', label: 'Aviso Administrativo', text: 'Tienes un aviso importante de parte del equipo de salud de BUAP. Por favor comunícate con nosotros.' }
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
    // Auto-select conversation if studentId query param is present
    const studentId = this.route.snapshot.queryParamMap.get('studentId');
    if (studentId) {
      let convo = this.conversations().find(c => c.student_id === studentId);
      if (!convo) {
        // ponytail: create conversation on the fly if not exists
        const currentUserId = this.authService.currentUser()?.id;
        const created = await this.chatService.getOrCreateConversation(studentId, currentUserId);
        if (created) {
          await this.loadConversations();
          convo = this.conversations().find(c => c.student_id === studentId && (!currentUserId || c.professional_id === currentUserId));
        }
      }
      if (convo) {
        this.selectConversation(convo);
      }
    }
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
    this.noPhoneWarning.set(!chat.student_phone);

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
    if (!this.newMessageText.trim() || !this.selectedChat() || this.isSending()) return;

    const chat = this.selectedChat()!;
    const currentUser = this.authService.currentUser();
    const senderName = currentUser ? (currentUser as any).name ?? 'Personal Clínico' : 'Personal Clínico';
    const text = this.newMessageText.trim();
    this.newMessageText = '';
    this.isSending.set(true);

    // Añadir mensaje optimista provisional a la vista
    const tempId = crypto.randomUUID();
    const tempMessage: WhatsAppMessage = {
      id: tempId,
      conversation_id: chat.id,
      sender_type: 'professional',
      sender_name: senderName,
      message_content: text,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    this.activeMessages.update(msgs => [...msgs, tempMessage]);
    this.scrollToBottom();

    // Enviar a BD + llamar Edge Function WhatsApp
    const result = await this.chatService.sendMessage(chat.id, text, senderName, chat.student_phone);
    this.isSending.set(false);

    if (!result) {
      // Fallo total al guardar en BD
      this.activeMessages.update(msgs =>
        msgs.map(m => m.id === tempId ? { ...m, status: 'failed', error_message: 'Error al guardar el mensaje.' } : m)
      );
    } else {
      // Sustituir el optimista por el real (puede tener status 'sent' o 'failed')
      this.activeMessages.update(msgs =>
        msgs.map(m => m.id === tempId ? { ...result, id: result.id } : m)
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
