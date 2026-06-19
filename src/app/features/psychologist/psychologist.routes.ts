import { Routes } from '@angular/router';
import { PsychologistLayoutComponent } from './psychologist-layout/psychologist-layout.component';

export const PSYCHOLOGIST_ROUTES: Routes = [
  {
    path: '',
    component: PsychologistLayoutComponent,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.PsychologistDashboardComponent)
      },
      {
        path: 'patients',
        loadComponent: () => import('./patients/patients.component').then(m => m.PatientsComponent)
      },
      {
        path: 'agenda',
        loadComponent: () => import('./agenda/agenda.component').then(m => m.AgendaComponent)
      },
      {
        path: 'patients/:id',
        loadComponent: () => import('./patient-profile/patient-profile.component').then(m => m.PatientProfileComponent)
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
