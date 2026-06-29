import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})

export class AdminLayoutComponent {
  authService = inject(AuthService);
  router = inject(Router);

  isSidebarCollapsed = false;

  navItems = [
    { label: 'Overview', sub: 'Panorama General', icon: 'dashboard', path: './overview' },
    { label: 'Faculties', sub: 'Facultades', icon: 'business', path: './faculties' },
    { label: 'Personal Médico', sub: 'Psicólogos y Nutriólogos', icon: 'assignment_ind', path: './psychologists' },
    { label: 'Patients', sub: 'Alumnos y Asignaciones', icon: 'people', path: './patients' },
    { label: 'Reports', sub: 'Reportes y Estadísticas', icon: 'insert_chart', path: './reports' },
    { label: 'Global Agenda', sub: 'Agenda Global', icon: 'calendar_today', path: './agenda' },
    { label: 'Configuración', sub: 'Marca de Agua Institucional', icon: 'settings', path: './settings' },
    { label: 'Alerts', sub: 'Alertas del Sistema', icon: 'notifications', path: './alerts', badge: 5 }
  ];

  get currentUser() {
    return this.authService.currentUser();
  }

  get todayDateString() {
    return new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  async logout() {
    this.authService.logout();
  }
}
