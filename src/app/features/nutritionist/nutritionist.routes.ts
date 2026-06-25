import { Routes } from '@angular/router';
import { NutritionistLayout } from './nutritionist-layout/nutritionist-layout.component';

export const NUTRITIONIST_ROUTES: Routes = [
  {
    path: '',
    component: NutritionistLayout,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.NutritionistDashboardComponent),
        data: { animation: 'DashboardPage' }
      },
      {
        path: 'pacientes',
        loadComponent: () => import('./pacientes/pacientes.component').then(m => m.Pacientes),
        data: { animation: 'PacientesPage' }
      },
      {
        path:'pacientes/:id',
        loadComponent: () => import('./perfil-paciente/perfil-paciente.component').then(m => m.PerfilPaciente),
        data: { animation: 'PerfilPacientePage' }
      },
      {
        path: 'agenda',
        loadComponent: () => import('./agenda/agenda.component').then(m => m.Agenda),
        data: { animation: 'AgendaPage' }
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  }
];
