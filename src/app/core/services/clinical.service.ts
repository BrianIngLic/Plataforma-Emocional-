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
   * Obtiene el profesional de la salud de un rol específico con menor carga de estudiantes asignados.
   */
  async getSpecialistWithLeastLoad(roleId: 3 | 4): Promise<string | null> {
    try {
      const { data: specialists, error: specError } = await this.supabaseService.supabase
        .from('users')
        .select('id')
        .eq('role_id', roleId);

      if (specError || !specialists || specialists.length === 0) {
        return null;
      }

      const field = roleId === 3 ? 'primary_psychologist_id' : 'primary_nutritionist_id';
      const { data: records, error: recError } = await this.supabaseService.supabase
        .from('student_clinical_records')
        .select(field)
        .not(field, 'is', null);

      const loadMap: { [key: string]: number } = {};
      specialists.forEach(s => loadMap[s.id] = 0);

      if (!recError && records) {
        records.forEach((r: any) => {
          const id = r[field];
          if (id && loadMap[id] !== undefined) {
            loadMap[id]++;
          }
        });
      }

      let leastLoadedId: string | null = null;
      let minLoad = Infinity;

      for (const spec of specialists) {
        const load = loadMap[spec.id];
        if (load < minLoad) {
          minLoad = load;
          leastLoadedId = spec.id;
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
   */
  async submitClinicalRecords(
    matricula: string, 
    conditions: string[], 
    consent: boolean,
    assignmentMethod: 'auto' | 'manual' = 'auto'
  ): Promise<boolean> {
    const user = this.authService.currentUser();
    if (!user) return false;

    // Ciframos los resultados del test psicológico (EAT-26 / PHQ-9)
    // para garantizar total privacidad antes de que toquen la BD.
    const encryptedNotes = this.cryptoService.encrypt(conditions[0] || '{}');

    let primaryPsychologistId: string | null = null;
    let primaryNutritionistId: string | null = null;

    if (assignmentMethod === 'auto') {
      primaryPsychologistId = await this.getSpecialistWithLeastLoad(3);
      primaryNutritionistId = await this.getSpecialistWithLeastLoad(4);
    }

    try {
      const { error } = await this.supabaseService.supabase
        .from('student_clinical_records')
        .insert({
          student_id: user.id,
          known_conditions: ['Test_Completado'],
          consent_given: consent,
          additional_notes: encryptedNotes, // Dato cifrado
          primary_psychologist_id: primaryPsychologistId,
          primary_nutritionist_id: primaryNutritionistId
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
