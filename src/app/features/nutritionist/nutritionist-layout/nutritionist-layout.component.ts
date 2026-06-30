import { Component } from '@angular/core';
import { inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {
  trigger,
  transition,
  style,
  animate,
  query
} from '@angular/animations';

@Component({
  selector: 'app-nutritionist-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './nutritionist-layout.html',
  styleUrl: './nutritionist-layout.scss',
  animations: [
    trigger('routeAnimations', [
      transition('* <=> *', [
        query(':enter, :leave', [
          style({
            position: 'absolute',
            width: '100%'
          })
        ], { optional: true }),

        query(':leave', [
          animate('200ms ease',
            style({ opacity: 0, transform: 'translateY(-10px)' })
          )
        ], { optional: true }),

        query(':enter', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          animate('200ms ease',
            style({ opacity: 1, transform: 'translateY(0)' })
          )
        ], { optional: true })

      ])
    ])
  ]
})
export class NutritionistLayout {
  authService = inject(AuthService);
  router = inject(Router);

  isSidebarCollapsed = false;
  currentAnimation: any;

  get currentUser() {
    return this.authService.currentUser();
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  async logout() {
    this.authService.logout();
  }

  onActivate(event: any, outlet: any) {
    setTimeout(() => {
      this.currentAnimation = outlet?.activatedRouteData?.['animation'];
    });
  }
}
