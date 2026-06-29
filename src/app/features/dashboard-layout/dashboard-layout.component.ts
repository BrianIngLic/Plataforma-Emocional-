import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { EmergencyNotificationService } from '../../core/services/emergency-notification.service';
import { SessionEvaluationService, PendingEvaluationItem } from '../../core/services/session-evaluation.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './dashboard-layout.component.html',
  styleUrls: ['./dashboard-layout.component.scss']
})
export class DashboardLayoutComponent implements OnInit {
  authService = inject(AuthService);
  chatService = inject(ChatService);
  emergencyNotificationService = inject(EmergencyNotificationService);
  evaluationService = inject(SessionEvaluationService);
  router = inject(Router);
  
  isSidebarCollapsed = false;
  showChatHistory = false;
  chatHistory: any[] = [];
  pendingEvaluations = signal<PendingEvaluationItem[]>([]);

  get currentUser() {
    return this.authService.currentUser();
  }

  isPsychologist() {
    return this.currentUser?.role === 'psychologist';
  }

  ngOnInit() {
    // Solicitar permiso de notificaciones Web Push de escritorio al entrar al dashboard
    this.emergencyNotificationService.requestWebPushPermission();

    // Inicializar escucha en vivo (Supabase Realtime) para disparar la notificación nativa al instante
    this.emergencyNotificationService.initRealtimeNotificationListener();

    this.checkPendingEvaluations();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.showChatHistory = event.urlAfterRedirects.includes('/dashboard/chat');
      if (this.showChatHistory) {
        this.loadHistory();
      }
      this.checkPendingEvaluations();
    });
    
    // Initial check
    this.showChatHistory = this.router.url.includes('/dashboard/chat');
    if (this.showChatHistory) {
      this.loadHistory();
    }
  }

  async checkPendingEvaluations() {
    const user = this.currentUser;
    if (user && user.role !== 'Psicologo' && user.role !== 'Nutricionista') {
      try {
        const pending = await this.evaluationService.getPendingEvaluations(user.id);
        this.pendingEvaluations.set(pending);
      } catch (err) {
        console.error('Error fetching pending evaluations:', err);
      }
    }
  }

  async loadHistory() {
    this.chatHistory = await this.chatService.getChatHistory();
  }

  async onNewAction() {
    if (this.isPsychologist()) {
      // lógica para nueva cita (si aplica)
    } else {
      if (this.showChatHistory) {
        await this.chatService.startNewChat();
        await this.loadHistory();
      } else {
        this.router.navigate(['/dashboard/chat']);
      }
    }
  }

  async loadChat(chatId: string) {
    await this.chatService.loadSpecificChat(chatId);
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  logout() {
    this.authService.logout();
  }
}
