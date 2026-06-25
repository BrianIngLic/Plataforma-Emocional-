import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuditService {
  private supabaseService = inject(SupabaseService);

  /**
   * Registra un evento de seguridad en la bitácora de Supabase (audit_logs).
   */
  async logEvent(eventType: string, description: string, userId?: string): Promise<void> {
    try {
      const payload: any = {
        event_type: eventType,
        description: description
      };
      if (userId && userId !== 'mock-user-id-123') {
        payload.user_id = userId;
      }

      const { error } = await this.supabaseService.supabase
        .from('audit_logs')
        .insert(payload);

      if (error) {
        console.warn('[AuditService] No se pudo registrar en audit_logs (modo offline o tabla faltante):', error.message);
      } else {
        console.log(`[AuditService] Evento ${eventType} registrado exitosamente.`);
      }
    } catch (e) {
      console.warn('[AuditService] Excepción al registrar evento:', e);
    }
  }

  /**
   * Helper para registrar intentos de acceso no autorizados entre roles.
   */
  async logUnauthorizedAccess(userId: string, currentRole: string, expectedRole: string, url: string): Promise<void> {
    const desc = `Intento de acceso denegado a la ruta '${url}'. Rol del usuario: '${currentRole}', Rol requerido: '${expectedRole}'.`;
    await this.logEvent('UNAUTHORIZED_ACCESS', desc, userId);
  }
}
