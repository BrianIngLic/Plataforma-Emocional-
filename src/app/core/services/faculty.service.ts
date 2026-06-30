import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Faculty {
  id: number | string;
  name: string;
  campus_id?: number;
  virtual_tour_url?: string;
  campuses?: { name: string }; // Join relation
}

export interface Campus {
  id: number;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class FacultyService {
  private supabaseService = inject(SupabaseService);

  async getFaculties(): Promise<Faculty[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('faculties')
      .select('*, campuses(name)')
      .order('name', { ascending: true });

    if (!error && data && data.length > 0) {
      return data;
    }

    // Fallback: 3 facultades de prueba
    return [
      { id: 1, name: 'Facultad de Ciencias de la Computación (FCC)' },
      { id: 2, name: 'Facultad de Medicina' },
      { id: 3, name: 'Facultad de Derecho y Ciencias Sociales' }
    ];
  }

  async getCampuses(): Promise<Campus[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('campuses')
      .select('*')
      .order('name', { ascending: true });
    
    if (!error && data) return data;
    return [];
  }

  async createFaculty(name: string, campus_id: number, virtual_tour_url?: string): Promise<{ data: any, error: any }> {
    const payload: any = { name, campus_id };
    if (virtual_tour_url) {
      payload.virtual_tour_url = virtual_tour_url;
    }
    return await this.supabaseService.supabase
      .from('faculties')
      .insert(payload)
      .select()
      .single();
  }

  async updateFaculty(id: number | string, name: string, virtual_tour_url?: string): Promise<{ data: any, error: any }> {
    return await this.supabaseService.supabase
      .from('faculties')
      .update({ name, virtual_tour_url })
      .eq('id', id)
      .select()
      .single();
  }

  async getFacultyById(id: number | string): Promise<Faculty | null> {
    const { data, error } = await this.supabaseService.supabase
      .from('faculties')
      .select('*, campuses(name)')
      .eq('id', id)
      .single();
    if (!error && data) return data;
    return null;
  }

  async assignSpecialist(professionalId: string, facultyId: number | string, facultyName: string): Promise<{ error: any }> {
    console.log(`[FacultyService] Intentando asignar especialista ${professionalId} a facultad ${facultyName} (${facultyId})`);
    
    // 1. Actualizar el campo de agrupación en profiles
    const { error: profileError } = await this.supabaseService.supabase
      .from('profiles')
      .update({ faculty: facultyName })
      .eq('user_id', professionalId);

    // 2. Actualizar la relación de clave foránea en settings
    const { error: settingsError } = await this.supabaseService.supabase
      .from('health_professional_settings')
      .update({ faculty_id: facultyId })
      .eq('professional_id', professionalId);

    return { error: settingsError || profileError };
  }

  async removeSpecialist(professionalId: string): Promise<{ error: any }> {
    console.log(`[FacultyService] Intentando retirar especialista ${professionalId}`);

    // 1. Limpiar el campo de agrupación en profiles
    const { error: profileError } = await this.supabaseService.supabase
      .from('profiles')
      .update({ faculty: null })
      .eq('user_id', professionalId);

    // 2. Limpiar la relación de clave foránea en settings
    const { error: settingsError } = await this.supabaseService.supabase
      .from('health_professional_settings')
      .update({ faculty_id: null })
      .eq('professional_id', professionalId);

    return { error: settingsError || profileError };
  }
}
