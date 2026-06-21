import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Faculty {
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
      .select('*')
      .order('name', { ascending: true });

    if (!error && data && data.length > 0) {
      return data;
    }

    // Fallback: 3 facultades de prueba si la tabla no existe o está vacía
    return [
      { id: 1, name: 'Facultad de Ciencias de la Computación (FCC)' },
      { id: 2, name: 'Facultad de Medicina' },
      { id: 3, name: 'Facultad de Derecho y Ciencias Sociales' }
    ];
  }
}
