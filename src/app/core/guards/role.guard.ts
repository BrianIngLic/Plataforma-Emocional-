import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { AuditService } from '../services/audit.service';

/**
 * Guard Funcional para proteger rutas basadas en el rol del usuario.
 * Requiere que el AuthGuard haya ejecutado primero.
 */
export const roleGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const auditService = inject(AuditService);
  const router = inject(Router);

  // Asegurar que la sesión inicial se ha cargado antes de revisar el rol
  await authService.checkSession();

  const user = authService.currentUser();
  
  // Si no hay sesión, la lógica normal lo hubiera redirigido al login, pero por si acaso.
  if (!user) {
    router.navigate(['/auth/login']);
    return false;
  }

  // Obtenemos el rol esperado para esta ruta
  const expectedRole = route.data?.['expectedRole'];
  
  // Si la ruta no especifica un rol, permitimos acceso libre
  if (!expectedRole) {
    return true;
  }

  // Verificamos si el usuario actual tiene el rol correcto
  if (user.role === expectedRole) {
    return true; // Acceso permitido
  }

  // Acceso Denegado: Registrar en la bitácora de auditoría (Audit Logs)
  await auditService.logUnauthorizedAccess(user.id, user.role, expectedRole, state.url);

  // Redirección automática al panel correspondiente
  if (user.role === 'Admin') {
    router.navigate(['/admin']);
  } else if (user.role === 'Psicologo') {
    router.navigate(['/psychologist']);
  } else if (user.role === 'Nutricionista') {
    router.navigate(['/nutritionist']);
  } else {
    // Estudiante o cualquier otro
    router.navigate(['/dashboard']);
  }

  return false;
};
