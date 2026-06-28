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
  
  // Propiedades de Gamificación Terapéutica
  calmLevel = 85;
  streakDays = 5;
  currentBadge = 'Vínculo de Confianza 🌟';
  activeReliefMode = false;

  inputText = '';
<<<<<<< HEAD
  suggestions = [
    { label: '¿Cómo manejo la ansiedad ahora?', icon: 'self_improvement' },
    { label: 'Siento mucha presión, necesito hablar', icon: 'volunteer_activism' },
    { label: 'Dime palabras de calma y compasión', icon: 'spa' },
    { label: 'Ayúdame con un ejercicio rápido', icon: 'bubble_chart' }
  ];
=======
  suggestions = ['¿Cómo manejo el estrés?', 'Necesito hablar de algo', 'Ejercicio de respiración', 'Me siento solo/a'];
  showMobileActions = false;
>>>>>>> a6d3afb (Paciente Responsive)

  @ViewChild('chatScroll') private chatScrollContainer!: ElementRef;

  constructor() {
    // Auto-scroll reactivo cada vez que la signal de mensajes se actualiza
    effect(() => {
      this.messages(); // track dependencies
      setTimeout(() => this.scrollToBottom(), 100);
    });
  }

  toggleMobileActions() {
    this.showMobileActions = !this.showMobileActions;
  }

  sendMessage() {
    if (this.inputText.trim()) {
      this.chatService.sendMessage(this.inputText);
      this.inputText = '';
<<<<<<< HEAD
      // Incrementar sutilmente el nivel de calma de forma gamificada
      if (this.calmLevel < 98) {
        this.calmLevel += 2;
      }
=======
      this.showMobileActions = false;
>>>>>>> a6d3afb (Paciente Responsive)
    }
  }

  sendSuggestion(suggestion: string) {
    this.chatService.sendMessage(suggestion);
<<<<<<< HEAD
    if (this.calmLevel < 98) {
      this.calmLevel += 2;
    }
  }

  toggleReliefMode() {
    this.activeReliefMode = !this.activeReliefMode;
=======
    this.showMobileActions = false;
>>>>>>> a6d3afb (Paciente Responsive)
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

