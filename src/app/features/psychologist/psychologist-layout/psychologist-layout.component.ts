import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-psychologist-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './psychologist-layout.component.html',
  styleUrls: ['./psychologist-layout.component.scss']
})
export class PsychologistLayoutComponent implements OnInit {
  authService = inject(AuthService);
  router = inject(Router);

  isSidebarCollapsed = false;

  get currentUser() {
    return this.authService.currentUser();
  }

  isMobile() {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  }

  ngOnInit() {
    if (this.isMobile()) {
      this.isSidebarCollapsed = true;
    }

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      if (this.isMobile()) {
        this.isSidebarCollapsed = true;
      }
    });
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  async logout() {
    this.authService.logout();
  }
}
