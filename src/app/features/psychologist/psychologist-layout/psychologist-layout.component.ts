import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-psychologist-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './psychologist-layout.component.html',
  styleUrls: ['./psychologist-layout.component.scss']
})
export class PsychologistLayoutComponent {
  authService = inject(AuthService);

  logout() {
    this.authService.logout();
  }
}
