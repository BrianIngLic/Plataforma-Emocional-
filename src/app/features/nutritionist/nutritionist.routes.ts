import { Routes } from '@angular/router';
import { NutritionistLayout } from './nutritionist-layout/nutritionist-layout.component';

export const NUTRITIONIST_ROUTES: Routes = [
  {
    path: '',
    component: NutritionistLayout,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('../health-professional/dashboard/dashboard.component').then(m => m.HealthProfessionalDashboardComponent),
        data: { animation: 'DashboardPage' }
      },
      {
        path: 'pacientes',
        loadComponent: () => import('../health-professional/patients/patients.component').then(m => m.HealthProfessionalPatientsComponent),
        data: { animation: 'PacientesPage' }
      },
      {
        path:'pacientes/:id',
        loadComponent: () => import('./perfil-paciente/perfil-paciente.component').then(m => m.PerfilPaciente),
        data: { animation: 'PerfilPacientePage' }
      },
      {
        path: 'agenda',
        loadComponent: () => import('../health-professional/agenda/agenda.component').then(m => m.HealthProfessionalAgendaComponent),
        data: { animation: 'AgendaPage' }
      },
      {
        path: 'settings',
        loadComponent: () => import('../health-professional/settings/settings.component').then(m => m.HealthProfessionalSettingsComponent)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  }
];
