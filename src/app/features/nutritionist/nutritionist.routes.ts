import { Routes } from '@angular/router';
import { NutritionistLayout } from './nutritionist-layout/nutritionist-layout.component';

export const NUTRITIONIST_ROUTES: Routes = [
  {
    path: '',
    component: NutritionistLayout,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.NutritionistDashboardComponent)
      },
      {
        path: 'pacientes',
        loadComponent: () => import('./pacientes/pacientes.component').then(m => m.Pacientes)
      },
      {
        path: 'agenda',
        loadComponent: () => import('./agenda/agenda.component').then(m => m.Agenda)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  }
];
