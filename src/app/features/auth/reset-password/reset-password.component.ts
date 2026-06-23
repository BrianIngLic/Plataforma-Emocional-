import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="auth-layout">
      <!-- Lado Izquierdo: Sidebar Educativo -->
      <aside class="auth-sidebar">
        <div class="sidebar-content">
          <div class="brand">
            <div class="logo-icon">🌿</div>
            <div class="brand-text">
              <h1>EmolA</h1>
              <span>Bienestar emocional</span>
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

      <!-- Lado Derecho: Formulario Reset Password -->
      <main class="auth-main">
        <div class="form-wrapper">
          <div class="form-header">
            <h2>Nueva Contraseña</h2>
            <p>Crea una nueva contraseña segura para tu cuenta.</p>
          </div>

          <form [formGroup]="resetForm" (ngSubmit)="onSubmit()" class="login-form">
            <div class="form-group">
              <label for="password">NUEVA CONTRASEÑA</label>
              <div class="input-icon-wrapper">
                <span class="icon">🔒</span>
                <input 
                  type="password" 
                  id="password" 
                  formControlName="password" 
                  placeholder="••••••••">
              </div>
            </div>
            
            <div class="form-group">
              <label for="confirmPassword">CONFIRMAR CONTRASEÑA</label>
              <div class="input-icon-wrapper">
                <span class="icon">🔒</span>
                <input 
                  type="password" 
                  id="confirmPassword" 
                  formControlName="confirmPassword" 
                  placeholder="••••••••">
              </div>
              <span class="error" *ngIf="resetForm.errors?.['mismatch'] && resetForm.get('confirmPassword')?.touched" style="color: #ef4444; font-size: 0.8rem; margin-top: 0.25rem; display: block;">
                Las contraseñas no coinciden.
              </span>
            </div>

            <div *ngIf="errorMessage" class="error-alert">
              {{ errorMessage }}
            </div>
            <div *ngIf="successMessage" class="success-alert" style="margin-top: 1rem; padding: 0.75rem; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; font-size: 0.9rem;">
              {{ successMessage }}
            </div>

            <button type="submit" class="btn-primary" [disabled]="resetForm.invalid || isLoading" style="margin-top: 1.5rem;">
              {{ isLoading ? 'Actualizando...' : 'Actualizar Contraseña &rarr;' }}
            </button>
          </form>
        </div>
      </main>
    </div>
  `,
  styleUrls: ['../login/login.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  resetForm: FormGroup = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit() {
    this.authService.checkSession().then(isLoggedIn => {
      if (!isLoggedIn) {
        this.errorMessage = 'El enlace de recuperación es inválido o ha expirado. Redirigiendo...';
        setTimeout(() => this.router.navigate(['/auth/login']), 3000);
      }
    });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { 'mismatch': true };
  }

  async onSubmit() {
    if (this.resetForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    const { password } = this.resetForm.value;

    const success = await this.authService.updatePassword(password);
    this.isLoading = false;

    if (success) {
      this.successMessage = 'Tu contraseña se ha restablecido correctamente. Redirigiendo...';
      setTimeout(() => this.router.navigate(['/dashboard']), 2000);
    } else {
      this.errorMessage = 'No pudimos actualizar tu contraseña. Por favor intenta de nuevo.';
    }
  }
}
