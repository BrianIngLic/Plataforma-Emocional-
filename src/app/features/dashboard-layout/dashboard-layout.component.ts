import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
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
  router = inject(Router);
  
  isSidebarCollapsed = false;
  showChatHistory = false;
  chatHistory: any[] = [];

  get currentUser() {
    return this.authService.currentUser();
  }

  isPsychologist() {
    return this.currentUser?.role === 'psychologist';
  }

  ngOnInit() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.showChatHistory = event.urlAfterRedirects.includes('/dashboard/chat');
      if (this.showChatHistory) {
        this.loadHistory();
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
