import { Routes } from '@angular/router';
import { PsychologistLayoutComponent } from './psychologist-layout/psychologist-layout.component';

export const PSYCHOLOGIST_ROUTES: Routes = [
  {
    path: '',
    component: PsychologistLayoutComponent,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('../health-professional/dashboard/dashboard.component').then(m => m.HealthProfessionalDashboardComponent)
      },
      {
        path: 'patients',
        loadComponent: () => import('../health-professional/patients/patients.component').then(m => m.HealthProfessionalPatientsComponent)
      },
      {
        path: 'agenda',
        loadComponent: () => import('../health-professional/agenda/agenda.component').then(m => m.HealthProfessionalAgendaComponent)
      },
      {
        path: 'patients/:id',
        loadComponent: () => import('./patient-profile/patient-profile.component').then(m => m.PatientProfileComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('../health-professional/settings/settings.component').then(m => m.HealthProfessionalSettingsComponent)
      },
      {
        path: 'whatsapp-chat',
        loadComponent: () => import('../health-professional/command-center-chat/command-center-chat.component').then(m => m.CommandCenterChatComponent)
      },
      {
        path: 'clinical-note/:id',
        loadComponent: () => import('./clinical-note/clinical-note.component').then(m => m.ClinicalNoteComponent)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  }
];
