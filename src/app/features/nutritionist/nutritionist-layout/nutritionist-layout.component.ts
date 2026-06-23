import { Component } from '@angular/core';
import { inject } from '@angular/core';
import { Router,RouterOutlet,RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';


@Component({
  selector: 'app-nutritionist-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './nutritionist-layout.html',
  styleUrl: './nutritionist-layout.scss',
})

export class NutritionistLayout {
  authService = inject(AuthService);
  router = inject(Router);

  isSidebarCollapsed = false;

  get currentUser() {
    return this.authService.currentUser();
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  async logout() {
    this.authService.logout();
  }
}
