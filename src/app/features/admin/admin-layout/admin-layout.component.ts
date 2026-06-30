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
    { label: 'Panorama General', sub: 'Métricas de ocupación', icon: 'dashboard', path: './overview' },
    { label: 'Facultades', sub: 'Gestión por divisiones', icon: 'business', path: './faculties' },
    { label: 'Personal Médico', sub: 'Psicólogos y Nutriólogos', icon: 'assignment_ind', path: './psychologists' },
    { label: 'Alumnos', sub: 'Asignaciones y seguimiento', icon: 'people', path: './patients' },
    { label: 'Reportes y Estadísticas', sub: 'Analítica institucional', icon: 'insert_chart', path: './reports' },
    { label: 'Agenda Global', sub: 'Calendario clínico', icon: 'calendar_today', path: './agenda' },
    { label: 'Configuración', sub: 'Mi perfil y foto', icon: 'settings', path: './settings' },
    { label: 'Imagen Institucional', sub: 'Sello y marca de agua', icon: 'branding_watermark', path: './institutional-branding' },
    { label: 'Alertas', sub: 'Notificaciones del sistema', icon: 'notifications', path: './alerts', badge: 5 }
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
