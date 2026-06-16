import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Guard Funcional para proteger rutas de la aplicación.
 * Redirige al login si el usuario no tiene una sesión activa.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true; // Acceso permitido
  }

  // Redirigir al login si no está autenticado
  router.navigate(['/auth/login']);
  return false;
};
