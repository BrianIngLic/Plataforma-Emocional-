import { Routes } from '@angular/router';
import { DashboardLayoutComponent } from './dashboard-layout.component';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: DashboardLayoutComponent,
    children: [
      {
        path: 'chat',
        loadChildren: () => import('../chat/chat.routes').then(m => m.CHAT_ROUTES)
      },
      {
        path: 'diary',
        loadChildren: () => import('../diary/diary.routes').then(m => m.DIARY_ROUTES)
      },
      {
        path: 'alimentario',
        loadChildren: () => import('../alimentary/alimentary.routes').then(m => m.ALIMENTARY_ROUTES)
      },
      {
        path: 'book-appointment',
        loadComponent: () => import('./student-agenda/student-agenda.component').then(m => m.StudentAgendaComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('../student/settings/student-settings.component').then(m => m.StudentSettingsComponent)
      },
      {
        path: 'session-feedback/:appointmentId',
        loadComponent: () => import('../student/session-feedback/session-feedback.component').then(m => m.SessionFeedbackComponent)
      },
      {
        path: 'achievements',
        loadComponent: () => import('../gamification/achievements-dashboard/achievements-dashboard.component').then(m => m.AchievementsDashboardComponent)
      },
      {
        path: '',
        redirectTo: 'chat',
        pathMatch: 'full'
      }
    ]
  }
];
