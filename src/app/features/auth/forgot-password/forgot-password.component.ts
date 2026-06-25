import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="auth-layout">
      <!-- Lado Izquierdo: Sidebar Educativo -->
      <aside class="auth-sidebar">
        <div class="sidebar-content">
          <div class="brand">
            <div class="logo" style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 2rem;">
              <img src="/amati-logo.svg" alt="Amati" style="width: 40px; height: 40px;" />
              <div class="brand-text" style="display: flex; flex-direction: column; text-align: left;">
                <h1>Amati</h1>
                <span>Bienestar emocional</span>
              </div>
            </div>
          </div>
          <div class="graphic-dots">
            <span class="dot d1"></span><span class="dot d2"></span><span class="dot d3"></span>
            <span class="dot d4"></span><span class="dot d5"></span><span class="dot d6"></span>
          </div>
          <div class="hero-text">
            <h2>Un espacio seguro<br><em>para sanar.</em></h2>
            <p>Acompañamiento emocional con inteligencia artificial, adaptado a tu ritmo y necesidades.</p>
          </div>
        </div>
      </aside>

      <!-- Lado Derecho: Formulario Forgot Password -->
      <main class="auth-main">
        <div class="form-wrapper">
          <div class="form-header">
            <h2>Recuperar Contraseña</h2>
            <p>Ingresa tu correo para enviarte un enlace de recuperación.</p>
          </div>

          <form [formGroup]="forgotForm" (ngSubmit)="onSubmit()" class="login-form">
            <div class="form-group">
              <label for="email">CORREO INSTITUCIONAL</label>
              <div class="input-icon-wrapper">
                <span class="icon">✉️</span>
                <input 
                  type="email" 
                  id="email" 
                  formControlName="email" 
                  placeholder="Ej. usuario@correo.com">
              </div>
              <span class="error" *ngIf="forgotForm.get('email')?.invalid && forgotForm.get('email')?.touched" style="color: #ef4444; font-size: 0.8rem; margin-top: 0.25rem; display: block;">
                Por favor ingresa un correo válido.
              </span>
            </div>

            <div *ngIf="errorMessage" class="error-alert">
              {{ errorMessage }}
            </div>
            <div *ngIf="successMessage" class="success-alert" style="margin-top: 1rem; padding: 0.75rem; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; font-size: 0.9rem;">
              {{ successMessage }}
            </div>

            <button type="submit" class="btn-primary" [disabled]="forgotForm.invalid || isLoading" style="margin-top: 1.5rem;">
              {{ isLoading ? 'Enviando...' : 'Enviar Enlace &rarr;' }}
            </button>
          </form>

          <div class="auth-footer">
            <p>¿Recordaste tu contraseña? <a routerLink="/auth/login">Volver al inicio de sesión</a></p>
          </div>
        </div>
      </main>
    </div>
  `,
  styleUrls: ['../login/login.component.scss']
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  forgotForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  async onSubmit() {
    if (this.forgotForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    const { email } = this.forgotForm.value;

    const success = await this.authService.requestPasswordReset(email);
    this.isLoading = false;

    if (success) {
      this.successMessage = 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.';
      setTimeout(() => this.router.navigate(['/auth/login']), 4000);
    } else {
      this.errorMessage = 'Hubo un problema al intentar enviar el correo. Por favor intenta de nuevo.';
    }
  }
}
