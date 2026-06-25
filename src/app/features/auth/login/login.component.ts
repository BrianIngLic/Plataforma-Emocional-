import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Componente de Login (Standalone)
 * Implementa la interfaz de inicio de sesión con Glassmorphism.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  email: string = '';
  pass: string = '';
  errorMessage: string = '';
  showPassword = false;
  showInactivityModal = false;

  ngOnInit() {
    if (sessionStorage.getItem('inactivity_logout') === 'true') {
      this.showInactivityModal = true;
      sessionStorage.removeItem('inactivity_logout');
    }
  }

  closeInactivityModal() {
    this.showInactivityModal = false;
  }

  async onLogin() {
    this.errorMessage = '';
    
    if (!this.email || !this.pass) {
      this.errorMessage = 'Por favor ingresa tu correo y contraseña.';
      return;
    }

    const success = await this.authService.login(this.email, this.pass);
    
    if (success) {
      const user = this.authService.currentUser();
      
      if (user?.requires_password_change) {
        this.router.navigate(['/auth/force-change']);
      } else if (user?.role === 'Admin') {
        this.router.navigate(['/admin']);
      } else if (user?.role === 'Psicologo') {
        this.router.navigate(['/psychologist']);
      } else {
        this.router.navigate(['/']);
      }
    } else {
      this.errorMessage = 'Correo o contraseña incorrectos.';
    }
  }
}
