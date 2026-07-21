import { Component, OnInit, AfterViewInit, OnDestroy, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-access',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-access.component.html',
  styleUrls: ['./admin-access.component.scss']
})
export class AdminAccessComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ngZone = inject(NgZone);

  email: string = '';
  initialEmail: string = '';
  mode: 'login' | 'register' = 'login';
  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;
  
  get hasSession(): boolean {
    return this.authService.isLoggedIn();
  }

  turnstileToken: string = '';
  turnstileWidgetId: any = null;

  webAuthnSupported: boolean = true;

  async ngOnInit(): Promise<void> {
    await this.authService.checkSession();
    
    // Detect WebAuthn/Passkeys support
    this.webAuthnSupported = window.PublicKeyCredential !== undefined;
    if (this.webAuthnSupported) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!available) {
          this.webAuthnSupported = false;
        }
      } catch (e) {
        this.webAuthnSupported = false;
      }
    }

    if (!this.webAuthnSupported) {
      this.errorMessage = 'Este dispositivo o navegador no admite Passkeys (WebAuthn). Para acceder como administrador, debes usar un dispositivo con biometría o llave física compatible.';
    }

    this.route.queryParams.subscribe(params => {
      if (params['mode'] === 'register') {
        this.mode = 'register';
      } else {
        this.mode = 'login';
      }
      
      if (params['email']) {
        this.email = params['email'];
        this.initialEmail = params['email'];
      }
    });
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
            console.error('Error rendering turnstile widget:', e);
          }
        }
      }, 100);
    });
  }

  async onSubmit(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    
    if (!this.email || !this.email.includes('@')) {
      this.errorMessage = 'Por favor ingresa un correo electrónico válido.';
      return;
    }

    if (this.mode === 'register' && (!this.email || this.email !== this.initialEmail)) {
      this.errorMessage = 'Acceso denegado: El correo no coincide con el enlace de invitación original.';
      return;
    }

    if (this.mode === 'login' && !this.turnstileToken) {
      this.errorMessage = 'Por favor completa la verificación de seguridad.';
      return;
    }

    this.isLoading = true;
    try {
      if (this.mode === 'login') {
        const success = await this.authService.loginWithPasskey(this.email, this.turnstileToken);
        if (success) {
          this.router.navigate(['/admin']);
        } else {
          this.errorMessage = 'Acceso denegado o error al verificar la identidad.';
        }
      } else {
        if (this.hasSession) {
          const user = this.authService.currentUser();
          if (!user || user.role !== 'Admin') {
            this.errorMessage = 'Acceso denegado: debes ser Administrador para enrolar.';
            this.isLoading = false;
            return;
          }
          await this.authService.registerPasskey();
          this.successMessage = 'Dispositivo registrado con éxito. Seguridad Passkey activa.';
        } else {
          const sent = await this.authService.sendMagicLink(this.email, this.turnstileToken);
          if (sent) {
            this.successMessage = 'Se ha enviado un enlace de acceso temporal a tu correo institucional.';
          } else {
            this.errorMessage = 'Error al enviar el enlace temporal.';
          }
        }
      }
    } catch (error: any) {
      this.errorMessage = error?.message || 'Error inesperado en el sistema.';
    } finally {
      this.isLoading = false;
      if ((window as any).turnstile && this.turnstileWidgetId !== null) {
        (window as any).turnstile.reset(this.turnstileWidgetId);
        this.turnstileToken = '';
      }
    }
  }
}
