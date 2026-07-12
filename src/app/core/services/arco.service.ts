import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

export interface PrivacySettings {
  user_id: string;
  share_clinical_data: boolean;
  use_anonymous_stats: boolean;
  updated_at?: string;
}

export interface ArcoRequest {
  id?: string;
  user_id: string;
  request_type: 'Access' | 'Rectification' | 'Cancellation' | 'Opposition';
  details: string;
  status?: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  resolution_notes?: string;
  created_at?: string;
  resolved_at?: string;
  user_email?: string; // Para visualización del admin
  user_matricula?: string; // Para visualización del admin
}

@Injectable({
  providedIn: 'root'
})
export class ArcoService {
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);

  /**
   * Obtiene la configuración de privacidad del usuario actual.
   * Si no existe, crea una por defecto.
   */
  async getPrivacySettings(): Promise<PrivacySettings | null> {
    const user = this.authService.currentUser();
    if (!user?.id) return null;

    try {
      const { data, error } = await this.supabaseService.supabase
        .from('user_privacy_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error al obtener preferencias de privacidad:', error.message);
        return null;
      }

      if (!data) {
        // Crear configuración por defecto si no existe
        const defaultSettings: PrivacySettings = {
          user_id: user.id,
          share_clinical_data: true,
          use_anonymous_stats: true
        };
        const { data: insertedData, error: insertError } = await this.supabaseService.supabase
          .from('user_privacy_settings')
          .insert(defaultSettings)
          .select()
          .single();

        if (insertError) {
          console.error('Error al insertar preferencias por defecto:', insertError.message);
          return defaultSettings;
        }
        return insertedData;
      }

      return data;
    } catch (e) {
      console.error('Excepción en getPrivacySettings:', e);
      return null;
    }
  }

  /**
   * Actualiza las preferencias de privacidad del usuario actual.
   */
  async updatePrivacySettings(shareClinicalData: boolean, useAnonymousStats: boolean): Promise<boolean> {
    const user = this.authService.currentUser();
    if (!user?.id) return false;

    try {
      const { error } = await this.supabaseService.supabase
        .from('user_privacy_settings')
        .upsert({
          user_id: user.id,
          share_clinical_data: shareClinicalData,
          use_anonymous_stats: useAnonymousStats,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error al actualizar preferencias de privacidad:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Excepción en updatePrivacySettings:', e);
      return false;
    }
  }

  /**
   * Envía una solicitud formal de Derechos ARCO (Rectificación o Cancelación).
   */
  async submitArcoRequest(requestType: 'Access' | 'Rectification' | 'Cancellation' | 'Opposition', details: string): Promise<boolean> {
    const user = this.authService.currentUser();
    if (!user?.id) return false;

    try {
      const { error } = await this.supabaseService.supabase
        .from('arco_requests')
        .insert({
          user_id: user.id,
          request_type: requestType,
          details: details,
          status: 'Pending'
        });

      if (error) {
        console.error('Error al insertar solicitud ARCO:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Excepción en submitArcoRequest:', e);
      return false;
    }
  }

  /**
   * Obtiene la lista de solicitudes del usuario actual.
   */
  async getMyArcoRequests(): Promise<ArcoRequest[]> {
    const user = this.authService.currentUser();
    if (!user?.id) return [];

    try {
      const { data, error } = await this.supabaseService.supabase
        .from('arco_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al obtener solicitudes ARCO del usuario:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Excepción en getMyArcoRequests:', e);
      return [];
    }
  }

  /**
   * (Admin) Obtiene todas las solicitudes ARCO pendientes y resueltas del sistema.
   */
  async getAllArcoRequests(): Promise<ArcoRequest[]> {
    try {
      // Obtenemos las solicitudes y hacemos un join con users y profiles para ver los datos de contacto
      const { data, error } = await this.supabaseService.supabase
        .from('arco_requests')
        .select(`
          *,
          users:user_id (matricula),
          profiles:user_id (first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al obtener todas las solicitudes ARCO:', error.message);
        return [];
      }

      // Mapeamos para aplanar y mostrar más fácilmente en el dashboard de administrador
      return (data || []).map((req: any) => ({
        ...req,
        user_matricula: req.users?.matricula || 'N/A',
        user_email: req.profiles ? `${req.profiles.first_name} ${req.profiles.last_name}` : 'Usuario Amati'
      }));
    } catch (e) {
      console.error('Excepción en getAllArcoRequests:', e);
      return [];
    }
  }

  /**
   * (Admin) Actualiza el estado de una solicitud ARCO.
   */
  async resolveArcoRequest(requestId: string, status: 'Approved' | 'Rejected' | 'Completed', notes: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.supabase
        .from('arco_requests')
        .update({
          status: status,
          resolution_notes: notes,
          resolved_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) {
        console.error('Error al actualizar estado de solicitud ARCO:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Excepción en resolveArcoRequest:', e);
      return false;
    }
  }

  /**
   * Construye y exporta un archivo JSON con toda la información personal almacenada del usuario (Acceso).
   */
  async exportUserData(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user?.id) {
      alert('Error: Sesión no iniciada.');
      return;
    }

    try {
      const dataDump: any = {
        metadata: {
          export_date: new Date().toISOString(),
          platform: 'Amati Plataforma Emocional',
          legal_basis: 'Derecho de Acceso (Derechos ARCO / LFPDPPP)'
        },
        account: {
          id: user.id,
          matricula: user.matricula,
          role: user.role,
          faculty: user.faculty
        }
      };

      // 1. Obtener Perfil
      const { data: profile } = await this.supabaseService.supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile) {
        dataDump.profile = {
          first_name: profile.first_name,
          last_name: profile.last_name,
          faculty: profile.faculty,
          programa_educativo: profile.programa_educativo,
          celular: user.mobile_phone || '',
          antecedentes_familiares: profile.antecedentes_familiares,
          sexo: profile.sexo,
          fecha_nacimiento: profile.fecha_nacimiento,
          created_at: profile.created_at
        };
      }

      // 2. Obtener Preferencias de Privacidad
      const { data: privacy } = await this.supabaseService.supabase
        .from('user_privacy_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (privacy) {
        dataDump.privacy_settings = {
          share_clinical_data: privacy.share_clinical_data,
          use_anonymous_stats: privacy.use_anonymous_stats,
          updated_at: privacy.updated_at
        };
      }

      // 3. Obtener Datos Específicos por Rol
      if (user.role === 'Estudiante') {
        // Expediente clínico
        const { data: clinical } = await this.supabaseService.supabase
          .from('student_clinical_records')
          .select('*')
          .eq('student_id', user.id)
          .maybeSingle();
        if (clinical) {
          dataDump.clinical_record = {
            consent_given: clinical.consent_given,
            known_conditions: clinical.known_conditions,
            additional_notes: clinical.additional_notes,
            updated_at: clinical.updated_at
          };
        }

        // Historial de Humor (Diario)
        const { data: moodLogs } = await this.supabaseService.supabase
          .from('mood_logs')
          .select('*')
          .eq('student_id', user.id);
        dataDump.mood_history = moodLogs || [];

        // Diario emocional (Entradas escritas)
        const { data: diaryEntries } = await this.supabaseService.supabase
          .from('diary_entries')
          .select('*')
          .eq('student_id', user.id);
        dataDump.diary_entries = diaryEntries || [];

        // Evaluaciones de sesión
        const { data: evaluations } = await this.supabaseService.supabase
          .from('session_evaluations')
          .select('*')
          .eq('student_id', user.id);
        dataDump.session_evaluations = evaluations || [];

      } else {
        // Si es psicólogo/nutriólogo o admin, exportar datos de citas atendidas
        const { data: appointments } = await this.supabaseService.supabase
          .from('appointments')
          .select('*')
          .or(`psychologist_id.eq.${user.id},nutritionist_id.eq.${user.id}`);
        dataDump.assigned_appointments = appointments || [];
      }

      // 4. Descargar archivo en el navegador
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataDump, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `mis_datos_amati_${user.matricula}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

    } catch (e) {
      console.error('Error al exportar datos personales:', e);
      alert('Ocurrió un error al descargar tu reporte de datos personales.');
    }
  }
}
