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

    const records = holidays.map(h => ({
      professional_id: null, // null significa global
      exception_date: h.date,
      description: h.localName
    }));

    // Evitar duplicados consultando excepciones existentes
    const holidayDates = records.map(r => r.exception_date);
    const { data: existing, error: queryErr } = await this.supabaseService.supabase
      .from('health_professional_exceptions')
      .select('exception_date')
      .is('professional_id', null)
      .in('exception_date', holidayDates);

    if (queryErr) {
      return { success: false, count: 0, error: queryErr };
    }

    const existingDates = new Set(existing?.map((e: any) => e.exception_date) || []);
    const newRecords = records.filter(r => !existingDates.has(r.exception_date));

    if (newRecords.length === 0) {
      return { success: true, count: 0 };
    }

    const { error: insertErr } = await this.supabaseService.supabase
      .from('health_professional_exceptions')
      .insert(newRecords);

    if (insertErr) {
      return { success: false, count: 0, error: insertErr };
    }

    return { success: true, count: newRecords.length };
  }

  // Registra una excepción manualmente
  async addException(date: string, reason: string, psychologistId: string | null = null) {
    const { data, error } = await this.supabaseService.supabase
      .from('health_professional_exceptions')
      .insert({
        professional_id: psychologistId,
        exception_date: date,
        description: reason
      });
      
    return { data, error };
  }
}
