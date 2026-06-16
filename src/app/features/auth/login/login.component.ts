import { Component, inject } from '@angular/core';
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
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  matricula: string = '';
  pass: string = '';
  errorMessage: string = '';
  showPassword = false;

  onLogin() {
    this.errorMessage = '';
    
    if (!this.matricula || !this.pass) {
      this.errorMessage = 'Por favor ingresa tu matrícula y contraseña.';
      return;
    }

    const success = this.authService.login(this.matricula, this.pass);
    
    if (success) {
      // Redirigir al panel principal
      this.router.navigate(['/']);
    } else {
      this.errorMessage = 'Matrícula o contraseña incorrectos.';
    }
  }
}
