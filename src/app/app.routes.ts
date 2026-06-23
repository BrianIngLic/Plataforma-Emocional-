import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard-layout/dashboard.routes').then(m => m.DASHBOARD_ROUTES),
    canActivate: [authGuard]
  },
  {
    path: 'psychologist',
    loadChildren: () => import('./features/psychologist/psychologist.routes').then(m => m.PSYCHOLOGIST_ROUTES),
    canActivate: [authGuard]
  },
  
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];

