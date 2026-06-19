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
    return true; // Acceso permitido
  }

  // Redirigir al login si no está autenticado
  router.navigate(['/auth/login']);
  return false;
};
