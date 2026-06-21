import { Routes } from '@angular/router';

export const ALIMENTARY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./alimentary-dashboard/alimentary-dashboard.component').then(m => m.AlimentaryDashboardComponent)
  }
];
