import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { EmergencyNotificationService } from '../../core/services/emergency-notification.service';
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
  router = inject(Router);
  
  isSidebarCollapsed = false;
  showChatHistory = false;
  chatHistory: any[] = [];

  get currentUser() {
    return this.authService.currentUser();
  }

  isMobile() {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  }

  isPsychologist() {
    return this.currentUser?.role === 'psychologist';
  }

  ngOnInit() {
    if (this.isMobile()) {
      this.isSidebarCollapsed = true;
    }

    // Solicitar permiso de notificaciones Web Push de escritorio al entrar al dashboard
    this.emergencyNotificationService.requestWebPushPermission();

    // Inicializar escucha en vivo (Supabase Realtime) para disparar la notificación nativa al instante
    this.emergencyNotificationService.initRealtimeNotificationListener();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.showChatHistory = event.urlAfterRedirects.includes('/dashboard/chat');
      if (this.showChatHistory) {
        this.loadHistory();
      }
      if (this.isMobile()) {
        this.isSidebarCollapsed = true;
      }
    });
    
    // Initial check
    this.showChatHistory = this.router.url.includes('/dashboard/chat');
    if (this.showChatHistory) {
      this.loadHistory();
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
    if (this.isMobile()) {
      this.isSidebarCollapsed = true;
    }
  }

  async loadChat(chatId: string) {
    await this.chatService.loadSpecificChat(chatId);
    if (this.isMobile()) {
      this.isSidebarCollapsed = true;
    }
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  logout() {
    this.authService.logout();
  }
}
