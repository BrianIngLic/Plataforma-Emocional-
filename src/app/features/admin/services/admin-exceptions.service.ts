import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SupabaseService } from '../../../core/services/supabase.service';

export interface Holiday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdminExceptionsService {
  private http = inject(HttpClient);
  private supabaseService = inject(SupabaseService);

  // Carga festivos de México desde Nager.Date API
  async getMexicoHolidays(year: number): Promise<Holiday[]> {
    return new Promise((resolve) => {
      this.http.get<Holiday[]>(`https://date.nager.at/api/v3/PublicHolidays/${year}/MX`)
        .subscribe({
          next: (data) => resolve(data),
          error: (err) => {
            console.error('Error fetching holidays', err);
            resolve([]);
          }
        });
    });
  }

  // Importar festivos a Supabase como excepciones globales
  async importHolidaysToSupabase(year: number): Promise<{ success: boolean, count: number, error?: any }> {
    const holidays = await this.getMexicoHolidays(year);
    if (!holidays || holidays.length === 0) return { success: false, count: 0 };

    // Filtramos para asegurar que no se dupliquen (Supabase puede rechazar duplicados si tuvieramos un constraint, pero por si acaso lo hacemos masivo)
    const records = holidays.map(h => ({
      professional_id: null, // null significa global
      exception_date: h.date,
      reason: h.localName
    }));

    const { data, error } = await this.supabaseService.supabase
      .from('health_professional_exceptions')
      .insert(records);

    if (error) {
      return { success: false, count: 0, error };
    }

    return { success: true, count: records.length };
  }

  // Registra una excepción manualmente
  async addException(date: string, reason: string, psychologistId: string | null = null) {
    const { data, error } = await this.supabaseService.supabase
      .from('health_professional_exceptions')
      .insert({
        professional_id: psychologistId,
        exception_date: date,
        reason: reason
      });
      
    return { data, error };
  }
}
