import { Component, ElementRef, ViewChild, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MarkdownModule } from 'ngx-markdown';
import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { GamificationService } from '../../../core/services/gamification.service';

@Component({
  selector: 'app-chat-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MarkdownModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  chatService = inject(ChatService);
  authService = inject(AuthService);
  gamificationService = inject(GamificationService);
  
  // Consumimos las signals directamente del servicio
  messages = this.chatService.messages;
  isTyping = this.chatService.isTyping;
  
  // Propiedades de Gamificación Terapéutica reactivas
  calmLevel = 85;
  currentBadge = 'Vínculo de Confianza 🌟';
  activeReliefMode = false;

  get streakDays(): number {
    return this.gamificationService.currentStreak();
  }

  inputText = '';
  suggestions = [
    { label: '¿Cómo manejo la ansiedad ahora?', icon: 'self_improvement' },
    { label: 'Siento mucha presión, necesito hablar', icon: 'volunteer_activism' },
    { label: 'Dime palabras de calma y compasión', icon: 'spa' },
    { label: 'Ayúdame con un ejercicio rápido', icon: 'bubble_chart' }
  ];

  @ViewChild('chatScroll') private chatScrollContainer!: ElementRef;

  constructor() {
    // Auto-scroll reactivo cada vez que la signal de mensajes se actualiza
    effect(() => {
      this.messages(); // track dependencies
      setTimeout(() => this.scrollToBottom(), 100);
    });
  }

  async ngOnInit() {
    // Cargar datos de racha y logros para mantener sincronizada la UI
    await this.gamificationService.loadGamificationData();
  }

  sendMessage() {
    if (this.inputText.trim()) {
      this.chatService.sendMessage(this.inputText);
      this.gamificationService.registerActivity('amati');
      this.inputText = '';
      // Incrementar sutilmente el nivel de calma de forma gamificada
      if (this.calmLevel < 98) {
        this.calmLevel += 2;
      }
    }
  }

  sendSuggestion(suggestion: string) {
    this.chatService.sendMessage(suggestion);
    this.gamificationService.registerActivity('amati');
    if (this.calmLevel < 98) {
      this.calmLevel += 2;
    }
  }

  toggleReliefMode() {
    this.activeReliefMode = !this.activeReliefMode;
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

