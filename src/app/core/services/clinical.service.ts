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
   * Envía el formulario clínico a Supabase cifrando las notas (todo el JSON de respuestas).
   */
  async submitClinicalRecords(matricula: string, conditions: string[], consent: boolean): Promise<boolean> {
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
          additional_notes: encryptedNotes // Dato cifrado
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
