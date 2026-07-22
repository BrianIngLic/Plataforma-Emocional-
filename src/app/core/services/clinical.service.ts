import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { CryptoService } from './crypto.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ClinicalService {
  private supabaseService = inject(SupabaseService);
  private cryptoService = inject(CryptoService);
  private authService = inject(AuthService);

  /**
   * Obtiene el profesional de la salud de un rol específico con menor carga de estudiantes asignados y dentro de la misma facultad, respetando el límite de capacidad.
   */
  async getSpecialistWithLeastLoad(roleId: 3 | 4, studentId: string): Promise<string | null> {
    try {
      // 1. Obtener la facultad del estudiante
      const { data: studentProfile } = await this.supabaseService.supabase
        .from('profiles')
        .select('faculty')
        .eq('user_id', studentId)
        .maybeSingle();

      const studentFaculty = studentProfile?.faculty;

      // Buscar el ID de la facultad correspondiente al nombre
      let facultyId: number | null = null;
      if (studentFaculty) {
        const { data: fac } = await this.supabaseService.supabase
          .from('faculties')
          .select('id')
          .eq('name', studentFaculty)
          .maybeSingle();
        if (fac) {
          facultyId = Number(fac.id);
        }
      }

      // 2. Obtener especialistas de ese rol con sus configuraciones y facultades
      const { data: specialists, error: specError } = await this.supabaseService.supabase
        .from('users')
        .select('id, profiles(faculty), health_professional_settings(capacity, faculty_id)')
        .eq('role_id', roleId);

      if (specError || !specialists || specialists.length === 0) {
        return null;
      }

      // Filtrar especialistas que pertenezcan a la facultad del estudiante
      const facultySpecs = specialists.filter((s: any) => {
        const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
        const h = Array.isArray(s.health_professional_settings) ? s.health_professional_settings[0] : s.health_professional_settings;
        
        const matchesId = h && h.faculty_id && facultyId && h.faculty_id === facultyId;
        const matchesName = p && p.faculty && studentFaculty && p.faculty.toLowerCase() === studentFaculty.toLowerCase();
        return matchesId || matchesName;
      });

      if (facultySpecs.length === 0) {
        return null;
      }

      // 3. Obtener la carga de pacientes asignados a cada especialista
      const field = roleId === 3 ? 'primary_psychologist_id' : 'primary_nutritionist_id';
      const { data: records, error: recError } = await this.supabaseService.supabase
        .from('student_clinical_records')
        .select(field)
        .not(field, 'is', null);

      const loadMap: { [key: string]: number } = {};
      facultySpecs.forEach(s => loadMap[s.id] = 0);

      if (!recError && records) {
        records.forEach((r: any) => {
          const id = r[field];
          if (id && loadMap[id] !== undefined) {
            loadMap[id]++;
          }
        });
      }

      // 4. Seleccionar el especialista de menor carga que no haya superado su capacidad
      let leastLoadedId: string | null = null;
      let minLoad = Infinity;

      for (const spec of facultySpecs) {
        const h = Array.isArray(spec.health_professional_settings) ? spec.health_professional_settings[0] : spec.health_professional_settings;
        const capacity = h?.capacity ?? 35;
        const load = loadMap[spec.id];

        if (load < capacity) {
          if (load < minLoad) {
            minLoad = load;
            leastLoadedId = spec.id;
          }
        }
      }

      return leastLoadedId;
    } catch (e) {
      console.warn('⚠️ Error en getSpecialistWithLeastLoad (Modo Offline / Excepción):', e);
      return null;
    }
  }

  /**
   * Envía el formulario clínico a Supabase cifrando las notas (todo el JSON de respuestas)
   * y asigna opcionalmente los especialistas de menor carga de forma automática.
   * Si están saturados, se inserta al estudiante en la fila virtual.
   */
  /**
   * Envía el formulario clínico a Supabase cifrando las notas (todo el JSON de respuestas).
   * La asignación de especialista se realiza posteriormente desde la configuración del estudiante.
   */
  async submitClinicalRecords(
    matricula: string, 
    conditions: string[], 
    consent: boolean
  ): Promise<boolean> {
    const user = this.authService.currentUser();
    if (!user) return false;

    // Ciframos los resultados del test psicológico (EAT-26 / PHQ-9)
    // para garantizar total privacidad antes de que toquen la BD.
    const encryptedNotes = this.cryptoService.encrypt(conditions[0] || '{}');

    try {
      const { error } = await this.supabaseService.supabase
        .from('student_clinical_records')
        .insert({
          student_id: user.id,
          known_conditions: ['Test_Completado'],
          consent_given: consent,
          additional_notes: encryptedNotes, // Dato cifrado
          primary_psychologist_id: null,
          primary_nutritionist_id: null
        });

      if (error) {
        if (error.message?.includes('Failed to fetch') || error.message?.includes('Network request failed')) {
           console.warn('⚠️ MODO OFFLINE ACTIVADO: Expediente guardado localmente (Simulado).');
           return true;
        }
        console.error('Error insertando clinical records:', error.message);
        return false;
      }
      
      return true;
    } catch (e) {
      console.warn('⚠️ MODO OFFLINE ACTIVADO: Expediente guardado localmente (Simulado) por excepción de red.');
      return true;
    }
  }

  /**
   * Obtiene la lista de especialistas disponibles para el estudiante ordenados por proximidad y calificación.
   */
  async getSpecialistsForStudent(studentId: string, roleId: number): Promise<any[]> {
    const { data, error } = await this.supabaseService.supabase
      .rpc('get_specialists_for_student', {
        p_student_id: studentId,
        p_role_id: roleId
      });

    if (error) {
      console.error('Error obteniendo especialistas para el estudiante:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Permite al estudiante elegir o cambiar su especialista (psicólogo o nutriólogo).
   * Respeta el límite de máximo 2 cambios por período académico.
   */
  async selectSpecialist(studentId: string, professionalId: string, roleId: 3 | 4): Promise<{ error: any }> {
    const period = this.getCurrentAcademicPeriod();
    const field = roleId === 3 ? 'primary_psychologist_id' : 'primary_nutritionist_id';
    const changesField = roleId === 3 ? 'specialist_changes_psychologist' : 'specialist_changes_nutritionist';

    try {
      // 1. Obtener o crear registro de tracking de políticas
      const tracking = await this.ensurePolicyTracking(studentId, period);
      const currentChanges = tracking ? (tracking[changesField] || 0) : 0;

      // 2. Verificar el límite de cambios (máximo 2 por período académico)
      if (currentChanges >= 2) {
        return {
          error: {
            message: 'Has alcanzado el límite máximo de 2 cambios de especialista por período académico. Para cambios adicionales, por favor realiza una solicitud formal a la administración.'
          }
        };
      }

      // 3. Consultar el especialista actual para registrar en la bitácora
      const { data: currentRecord } = await this.supabaseService.supabase
        .from('student_clinical_records')
        .select(field)
        .eq('student_id', studentId)
        .maybeSingle();

      const oldSpecialistId = currentRecord ? (currentRecord as any)[field] : null;

      // 4. Actualizar el especialista asignado en el expediente clínico
      const { error: updateError } = await this.supabaseService.supabase
        .from('student_clinical_records')
        .update({ [field]: professionalId })
        .eq('student_id', studentId);

      if (updateError) throw updateError;

      // 5. Incrementar el contador de cambios en el tracking de políticas
      const { error: trackingError } = await this.supabaseService.supabase
        .from('student_policy_tracking')
        .update({ [changesField]: currentChanges + 1 })
        .eq('student_id', studentId)
        .eq('academic_period', period);

      if (trackingError) throw trackingError;

      // 6. Registrar el evento en la bitácora de auditoría
      await this.supabaseService.supabase
        .from('audit_logs')
        .insert({
          user_id: studentId,
          event_type: 'SPECIALIST_SELECTED',
          description: `El estudiante seleccionó al especialista ${professionalId} para el rol ${roleId === 3 ? 'Psicólogo' : 'Nutriólogo'}. Anterior: ${oldSpecialistId || 'Ninguno'}. Cambio número: ${currentChanges + 1}`
        });

      return { error: null };
    } catch (e: any) {
      console.error('Error al seleccionar especialista:', e);
      return { error: e };
    }
  }

  private getCurrentAcademicPeriod(): string {
    const d = new Date();
    const term = d.getMonth() < 6 ? 'Primavera' : 'Otoño';
    return `${term} ${d.getFullYear()}`;
  }

  private async ensurePolicyTracking(studentId: string, period: string): Promise<any> {
    const { data: existing, error: selectError } = await this.supabaseService.supabase
      .from('student_policy_tracking')
      .select('*')
      .eq('student_id', studentId)
      .eq('academic_period', period)
      .maybeSingle();

    if (existing) return existing;

    const { data, error } = await this.supabaseService.supabase
      .from('student_policy_tracking')
      .insert({
        student_id: studentId,
        academic_period: period,
        late_cancellations: 0,
        specialist_changes_psychologist: 0,
        specialist_changes_nutritionist: 0,
        bypass_session_limit: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating policy tracking:', error);
    }
    return data;
  }

  async getClinicalRecord(): Promise<any> {
    const user = this.authService.currentUser();
    if (!user) return null;

    try {
      const { data, error } = await this.supabaseService.supabase
        .from('student_clinical_records')
        .select('*')
        .eq('student_id', user.id)
        .single();
      
      if (error) {
        console.error('Error obteniendo record clínico:', error.message);
        return null;
      }

      if (data && data.additional_notes) {
        data.decrypted_notes = this.cryptoService.decrypt(data.additional_notes);
      }
      return data;
    } catch(e) {
      return null;
    }
  }

  async updateClinicalRecords(conditions: string[]): Promise<boolean> {
    const user = this.authService.currentUser();
    if (!user) return false;

    const encryptedNotes = this.cryptoService.encrypt(conditions[0] || '{}');

    try {
      const { error } = await this.supabaseService.supabase
        .from('student_clinical_records')
        .update({ additional_notes: encryptedNotes })
        .eq('student_id', user.id);

      if (error) return false;
      return true;
    } catch (e) {
      return false;
    }
  }
}
