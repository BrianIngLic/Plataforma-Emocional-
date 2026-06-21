import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Faculty {
  id: number | string;
  name: string;
  campus_id?: number;
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

  async createFaculty(name: string, campus_id: number): Promise<{ data: any, error: any }> {
    return await this.supabaseService.supabase
      .from('faculties')
      .insert({ name, campus_id })
      .select()
      .single();
  }
}
