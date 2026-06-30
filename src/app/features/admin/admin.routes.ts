import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      {
        path: 'overview',
        loadComponent: () => import('./overview/overview.component').then(m => m.OverviewComponent)
      },
      {
        path: 'faculties',
        loadComponent: () => import('./faculties/faculties.component').then(m => m.FacultiesComponent)
      },
      {
        path: 'psychologists',
        loadComponent: () => import('./psychologists/psychologists.component').then(m => m.PsychologistsComponent)
      },
      {
        path: 'patients',
        loadComponent: () => import('./patients/patients.component').then(m => m.PatientsComponent)
      },
      {
        path: 'reports',
        loadComponent: () => import('./reports/reports.component').then(m => m.ReportsComponent)
      },
      {
        path: 'agenda',
        loadComponent: () => import('./agenda/agenda.component').then(m => m.AgendaComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./admin-settings/admin-settings.component').then(m => m.AdminSettingsComponent)
      },
      {
        path: 'institutional-branding',
        loadComponent: () => import('./institutional-settings/institutional-settings.component').then(m => m.InstitutionalSettingsComponent)
      },
      {
        path: 'faculties/:id',
        loadComponent: () => import('./faculties/faculty-detail/faculty-detail.component').then(m => m.FacultyDetailComponent)
      },
      {
        path: 'whatsapp-chat',
        loadComponent: () => import('../health-professional/command-center-chat/command-center-chat.component').then(m => m.CommandCenterChatComponent)
      },
      {
        path: '',
        redirectTo: 'overview',
        pathMatch: 'full'
      }
    ]
  }
];
