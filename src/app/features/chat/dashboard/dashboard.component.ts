import { Component, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MarkdownModule } from 'ngx-markdown';
import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-chat-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MarkdownModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  chatService = inject(ChatService);
  authService = inject(AuthService);
  
  // Consumimos las signals directamente del servicio
  messages = this.chatService.messages;
  isTyping = this.chatService.isTyping;
  
  inputText = '';
  suggestions = ['¿Cómo manejo el estrés?', 'Necesito hablar de algo', 'Ejercicio de respiración', 'Me siento solo/a'];

  @ViewChild('chatScroll') private chatScrollContainer!: ElementRef;

  constructor() {
    // Auto-scroll reactivo cada vez que la signal de mensajes se actualiza
    effect(() => {
      this.messages(); // track dependencies
      setTimeout(() => this.scrollToBottom(), 100);
    });
  }

  sendMessage() {
    if (this.inputText.trim()) {
      this.chatService.sendMessage(this.inputText);
      this.inputText = '';
    }
  }

  sendSuggestion(suggestion: string) {
    this.chatService.sendMessage(suggestion);
  }

  logout() {
    this.authService.logout();
  }

  private scrollToBottom(): void {
    try {
      this.chatScrollContainer.nativeElement.scrollTop = this.chatScrollContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }
}
