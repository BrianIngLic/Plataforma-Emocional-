import { Routes } from '@angular/router';
import { NutritionistLayout } from './nutritionist-layout/nutritionist-layout.component';

export const NUTRITIONIST_ROUTES: Routes = [
  {
    path: '',
    component: NutritionistLayout,
    children: [
      {
        path: '',
      }
    ]
  }
];
