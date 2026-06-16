import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Interceptor Funcional para inyectar JWT en todas las peticiones a PostgREST/FastAPI.
 * @param req La petición original
 * @param next El handler de ejecución
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Si existe el token, clonamos la petición inyectando el header Authorization
  if (token) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(authReq);
  }

  // Petición original si no hay token
  return next(req);
};
