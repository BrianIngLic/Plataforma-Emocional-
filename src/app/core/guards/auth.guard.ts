import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Guard Funcional para proteger rutas de la aplicación.
 * Redirige al login si el usuario no tiene una sesión activa.
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const hasSession = await authService.checkSession();
  
  if (hasSession) {
    const user = authService.currentUser();
    
    // Si es Administrador, validar obligatoriedad de Passkeys (AMR contiene webauthn/passkey/hw)
    if (user?.role === 'Admin') {
      const amr = await authService.getSessionAmr();
      console.log('[Security Guard] AMR claims raw:', amr);
      const methods = amr.map((item: any) => {
        if (typeof item === 'object' && item !== null && 'method' in item) {
          return item.method;
        }
        return String(item);
      });
      console.log('[Security Guard] AMR parsed methods:', methods);
      const hasPasskey = methods.includes('webauthn') || methods.includes('passkey') || methods.includes('hw');
      if (!hasPasskey) {
        console.warn('[Security Guard] Admin ingresó sin Passkey (AMR inválido). Cerrando sesión.');
        await authService.logout('/sistema/acceso');
        return false;
      }
    }

    if (user?.requires_password_change) {
      router.navigate(['/auth/force-change']);
      return false;
    }
    return true; // Acceso permitido
  }

  // Redirigir al login si no está autenticado
  router.navigate(['/auth/login']);
  return false;
};
