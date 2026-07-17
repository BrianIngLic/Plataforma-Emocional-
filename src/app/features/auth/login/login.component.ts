import { Component, OnInit, inject, HostListener, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

/**
 * Componente de Login (Standalone)
 * Implementa la interfaz de inicio de sesión con Glassmorphism.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  email: string = '';
  pass: string = '';
  errorMessage: string = '';
  showPassword = false;
  showInactivityModal = false;
  showEtymology = false;

  turnstileToken: string = '';
  turnstileWidgetId: any = null;

  get isCaptchaRequired(): boolean {
    return !!(window as any).turnstile;
  }

  toggleEtymology(event: MouseEvent) {
    event.stopPropagation();
    this.showEtymology = !this.showEtymology;
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.showEtymology = false;
  }

  ngOnInit() {
    if (sessionStorage.getItem('inactivity_logout') === 'true') {
      this.showInactivityModal = true;
      sessionStorage.removeItem('inactivity_logout');
    }
  }

  ngAfterViewInit() {
    this.renderTurnstile();
  }

  ngOnDestroy() {
    if (this.turnstileWidgetId !== null && (window as any).turnstile) {
      try {
        (window as any).turnstile.remove(this.turnstileWidgetId);
      } catch (e) {
        console.error('Error removing turnstile widget:', e);
      }
    }
  }

  private renderTurnstile() {
    this.ngZone.runOutsideAngular(() => {
      const checkTurnstile = setInterval(() => {
        if ((window as any).turnstile) {
          clearInterval(checkTurnstile);
          try {
            const container = document.getElementById('turnstile-container');
            if (container) {
              this.turnstileWidgetId = (window as any).turnstile.render('#turnstile-container', {
                sitekey: environment.turnstileSiteKey,
                callback: (token: string) => {
                  this.ngZone.run(() => {
                    this.turnstileToken = token;
                    this.errorMessage = '';
                  });
                },
                'error-callback': () => {
                  this.ngZone.run(() => {
                    this.turnstileToken = '';
                    this.errorMessage = 'Error de verificación de seguridad. Por favor intenta de nuevo.';
                  });
                },
                'expired-callback': () => {
                  this.ngZone.run(() => {
                    this.turnstileToken = '';
                    this.errorMessage = 'La verificación de seguridad ha expirado. Por favor resuélvela de nuevo.';
                  });
                }
              });
            }
          } catch (e) {
            console.error('Turnstile render failed:', e);
          }
        }
      }, 100);

      // Timeout de 10s para limpiar el intervalo si no se carga
      setTimeout(() => clearInterval(checkTurnstile), 10000);
    });
  }

  closeInactivityModal() {
    this.showInactivityModal = false;
  }

  sanitizeEmailInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.email = input.value.replace(/\s/g, '').replace(/[^a-zA-Z0-9@._-]/g, '');
    input.value = this.email;
  }

  sanitizePasswordInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.pass = input.value.replace(/\s/g, '');
    input.value = this.pass;
  }

  private isEmailValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async onLogin() {
    this.errorMessage = '';

    if (!this.email || !this.pass) {
      this.errorMessage = 'Por favor ingresa tu correo y contraseña.';
      return;
    }

    if ((window as any).turnstile && !this.turnstileToken) {
      this.errorMessage = 'Por favor completa la verificación de seguridad (CAPTCHA).';
      return;
    }

    if (!this.isEmailValid(this.email)) {
      this.errorMessage = 'Ingresa un correo electrónico válido.';
      return;
    }

    if (this.pass.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    const success = await this.authService.login(this.email, this.pass, this.turnstileToken);
    
    if (success) {
      const user = this.authService.currentUser();
      this.email = '';
      this.pass = '';
      
      if (user?.requires_password_change) {
        this.router.navigate(['/auth/force-change']);
      } else if (user?.role === 'Admin') {
        this.router.navigate(['/admin']);
      } else if (user?.role === 'Psicologo') {
        this.router.navigate(['/psychologist']);
      } else if (user?.role === 'Nutricionista') {
        this.router.navigate(['/nutritionist']);
      } else {
        this.router.navigate(['/']);
      }
    } else {
      this.email = '';
      this.pass = '';
      this.errorMessage = 'Correo o contraseña incorrectos.';
      if ((window as any).turnstile && this.turnstileWidgetId !== null) {
        try {
          (window as any).turnstile.reset(this.turnstileWidgetId);
          this.turnstileToken = '';
        } catch (e) {
          console.error('Error resetting Turnstile:', e);
        }
      }
    }
  }
}
