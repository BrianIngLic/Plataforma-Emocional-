import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { SupabaseService } from '../services/supabase.service';

/**
 * Interceptor Funcional para inyectar JWT en peticiones a FastAPI u otros servicios externos.
 * @param req La petición original
 * @param next El handler de ejecución
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const supabaseService = inject(SupabaseService);

  // Si la petición va dirigida al mismo Supabase, no inyectamos nosotros,
  // el cliente de Supabase (Supabase-js) lo maneja automáticamente.
  if (req.url.includes('supabase.co')) {
    return next(req);
  }

  // Convertimos la promesa de getSession a un Observable
  return from(supabaseService.supabase.auth.getSession()).pipe(
    switchMap(({ data }) => {
      const token = data?.session?.access_token;

      if (token) {
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
        return next(authReq);
      }
      
      return next(req);
    })
  );
};
