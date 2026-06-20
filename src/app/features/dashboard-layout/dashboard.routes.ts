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
        path: 'book-appointment',
        loadComponent: () => import('./student-agenda/student-agenda.component').then(m => m.StudentAgendaComponent)
      },
      {
        path: '',
        redirectTo: 'chat',
        pathMatch: 'full'
      }
    ]
  }
];
