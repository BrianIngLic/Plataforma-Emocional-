import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';

export interface HealthProfessionalRegistrationPayload {
  userId: string;
  matricula: string;
  roleId: 3 | 4; // 3 = Psicólogo, 4 = Nutriólogo
  firstName: string;
  lastName: string;
  faculty: string;
  programaEducativo?: string;
  celular?: string;
  capacity?: number;
  location?: string;
  modality?: 'virtual' | 'presencial';
  facultyId?: number;
}

export interface PatientAssignmentPayload {
  studentId: string;
  primaryPsychologistId?: string | null;
  primaryNutritionistId?: string | null;
}

export interface HealthProfessionalItem {
  id: string;
  role_id: number;
  role_name: string;
  matricula: string;
  first_name: string;
  last_name: string;
  faculty: string;
  email: string;
  capacity: number;
  location: string;
  modality: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminSkill8Service {
  private supabase = inject(SupabaseService).supabase;
  private authService = inject(AuthService);

  /**
   * Obtiene la lista unificada de profesionales de la salud (Psicólogos y Nutriólogos)
   * Invocando la función RPC segura get_admin_health_professionals.
   */
  async getHealthProfessionals(): Promise<HealthProfessionalItem[]> {
    try {
      console.log('🛡️ [Admin Skill 8]: Consultando directorio unificado de profesionales de la salud...');
      let { data, error } = await this.supabase.rpc('get_admin_health_professionals');

      if (error || !data) {
        console.warn('⚠️ RPC get_admin_health_professionals no disponible (404/Error). Activando fallback transparente...');
        const { data: fallbackUsers, error: fbErr } = await this.supabase
          .from('users')
          .select(`
            id, role_id, matricula,
            profiles (first_name, last_name, faculty, celular),
            health_professional_settings (capacity, location, modality)
          `)
          .in('role_id', [3, 4]);

        if (fbErr || !fallbackUsers) {
          console.error('❌ Error en fallback de getHealthProfessionals:', fbErr);
          throw fbErr || new Error('No se pudo obtener profesionales de la salud');
        }

        data = fallbackUsers.map((u: any) => {
          const p = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles;
          const h = Array.isArray(u.health_professional_settings) ? u.health_professional_settings[0] : u.health_professional_settings;
          return {
            id: u.id,
            role_id: u.role_id,
            matricula: u.matricula || '',
            first_name: p?.first_name || '',
            last_name: p?.last_name || '',
            email: `${u.matricula || u.id.slice(0, 8)}@ep.buap.mx`,
            faculty: p?.faculty || '',
            celular: p?.celular || '',
            capacity: h?.capacity || 40,
            location: h?.location || 'Consultorio Virtual',
            modality: h?.modality || 'virtual'
          };
        });
      }

      return (data as HealthProfessionalItem[]) || [];
    } catch (err: any) {
      console.error('❌ Excepción en getHealthProfessionals:', err);
      throw err;
    }
  }

  /**
   * Registra o actualiza de manera centralizada a un especialista de la salud (Psicólogo o Nutriólogo).
   * Ejecuta la función RPC segura admin_register_health_professional garantizando atomicidad y auditoría.
   */
  async registerHealthProfessional(payload: HealthProfessionalRegistrationPayload): Promise<any> {
    try {
      console.log(`🛡️ [Admin Skill 8]: Ejecutando alta centralizada para rol ${payload.roleId} (Usuario ID: ${payload.userId})...`);
      
      const rpcParams = {
        p_user_id: payload.userId,
        p_matricula: payload.matricula,
        p_role_id: payload.roleId,
        p_first_name: payload.firstName,
        p_last_name: payload.lastName,
        p_faculty: payload.faculty,
        p_programa_educativo: payload.programaEducativo || 'Jefatura de Bienestar BUAP',
        p_celular: payload.celular || 'No registrado',
        p_capacity: payload.capacity || 35,
        p_location: payload.location || 'Consultorio Virtual',
        p_modality: payload.modality || 'virtual',
        p_faculty_id: payload.facultyId || null
      };

      const { data, error } = await this.supabase.rpc('admin_register_health_professional', rpcParams);

      if (error) {
        console.error('❌ Error ejecutando admin_register_health_professional:', error);
        throw error;
      }

      console.log('✅ [Admin Skill 8]: Profesional registrado exitosamente:', data);
      return data;
    } catch (err: any) {
      console.error('❌ Excepción en registerHealthProfessional:', err);
      throw err;
    }
  }

  /**
   * Asigna un paciente (estudiante) a su psicólogo y/o nutriólogo primario.
   * Ejecuta la función RPC admin_assign_patient_to_professionals con verificación de roles y auditoría.
   */
  async assignPatientToProfessionals(payload: PatientAssignmentPayload): Promise<any> {
    try {
      console.log(`🛡️ [Admin Skill 8]: Asignando paciente ${payload.studentId} a especialistas...`, payload);

      const rpcParams = {
        p_student_id: payload.studentId,
        p_primary_psychologist_id: payload.primaryPsychologistId || null,
        p_primary_nutritionist_id: payload.primaryNutritionistId || null
      };

      const { data, error } = await this.supabase.rpc('admin_assign_patient_to_professionals', rpcParams);

      if (error) {
        console.error('❌ Error ejecutando admin_assign_patient_to_professionals:', error);
        throw error;
      }

      console.log('✅ [Admin Skill 8]: Paciente asignado exitosamente:', data);
      return data;
    } catch (err: any) {
      console.error('❌ Excepción en assignPatientToProfessionals:', err);
      throw err;
    }
  }

  /**
   * Sube o actualiza la Marca de Agua Institucional o activos gráficos en el bucket 'institutional_assets'.
   * Protegido por RLS (Solo Admin).
   */
  async uploadInstitutionalAsset(file: File, customPath?: string): Promise<{ path: string; url: string }> {
    try {
      const filePath = customPath || `watermarks/${Date.now()}_${file.name}`;
      console.log(`📦 [Storage Routing]: Subiendo archivo ${file.name} al bucket institutional_assets en ruta ${filePath}...`);

      const { data, error } = await this.supabase.storage
        .from('institutional_assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('❌ Error al subir activo institucional:', error);
        throw error;
      }

      const publicUrl = this.getInstitutionalAssetUrl(filePath);
      console.log(`✅ [Storage Routing]: Activo institucional subido correctamente. URL Pública: ${publicUrl}`);

      return { path: data?.path || filePath, url: publicUrl };
    } catch (err: any) {
      console.error('❌ Excepción en uploadInstitutionalAsset:', err);
      throw err;
    }
  }

  /**
   * Obtiene la URL pública directa para consultar la Marca de Agua o Activo Institucional.
   */
  getInstitutionalAssetUrl(path: string): string {
    const { data } = this.supabase.storage
      .from('institutional_assets')
      .getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Lista todos los activos institucionales disponibles en una ruta del bucket 'institutional_assets'.
   */
  async listInstitutionalAssets(path: string = 'watermarks'): Promise<any[]> {
    try {
      console.log(`📦 [Storage Routing]: Listando archivos en institutional_assets/${path}...`);
      const { data, error } = await this.supabase.storage
        .from('institutional_assets')
        .list(path, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) {
        console.error('❌ Error listando activos en institutional_assets:', error);
        throw error;
      }

      return data || [];
    } catch (err: any) {
      console.error('❌ Excepción en listInstitutionalAssets:', err);
      throw err;
    }
  }

  /**
   * Obtiene a los estudiantes (role_id = 2) que no tienen asignado un psicólogo o nutriólogo primario.
   */
  async getOrphanedStudents(): Promise<any[]> {
    try {
      console.log('🛡️ [Admin Skill 8]: Consultando estudiantes sin asignación médica (Orphaned Students)...');
      const { data, error } = await this.supabase
        .from('users')
        .select(`
          id,
          matricula,
          profiles (first_name, last_name, faculty),
          student_clinical_records (primary_psychologist_id, primary_nutritionist_id)
        `)
        .eq('role_id', 2);

      if (error) {
        console.error('❌ Error consultando orphaned students:', error);
        throw error;
      }

      // Filtrar aquellos donde no tengan primary_psychologist_id o primary_nutritionist_id
      return (data || []).map((u: any) => {
        const p = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles;
        const rec = Array.isArray(u.student_clinical_records) ? u.student_clinical_records[0] : u.student_clinical_records;
        return {
          id: u.id,
          matricula: u.matricula,
          name: `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Alumno sin nombre',
          faculty: p?.faculty || 'Desconocida',
          hasPsychologist: !!rec?.primary_psychologist_id,
          hasNutritionist: !!rec?.primary_nutritionist_id,
          primaryPsychologistId: rec?.primary_psychologist_id || null,
          primaryNutritionistId: rec?.primary_nutritionist_id || null
        };
      }).filter((u: any) => !u.hasPsychologist || !u.hasNutritionist);
    } catch (err: any) {
      console.error('❌ Excepción en getOrphanedStudents:', err);
      return [];
    }
  }
}
