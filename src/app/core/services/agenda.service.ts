import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface TimeBlock {
  start: string;
  end: string;
}

export interface WorkingDay {
  active: boolean;
  blocks: TimeBlock[];
}

export interface WorkingDaysMap {
  [key: string]: WorkingDay;
}

@Injectable({
  providedIn: 'root'
})
export class AgendaService {
  private supabase = inject(SupabaseService).supabase;

  async getSettings(psychologistId: string) {
    const { data, error } = await this.supabase
      .from('psychologist_settings')
      .select('*')
      .eq('psychologist_id', psychologistId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
    }
    return data;
  }

  async saveSettings(psychologistId: string, duration: number, workingDays: WorkingDaysMap) {
    const { data, error } = await this.supabase
      .from('psychologist_settings')
      .upsert({ 
        psychologist_id: psychologistId, 
        session_duration: duration, 
        working_days: workingDays 
      });
    
    if (error) throw error;
    return data;
  }

  async getExceptions(psychologistId: string) {
    const { data, error } = await this.supabase
      .from('psychologist_exceptions')
      .select('*')
      .or(`psychologist_id.eq.${psychologistId},psychologist_id.is.null`)
      .order('exception_date', { ascending: true });
      
    if (error) console.error('Error fetching exceptions:', error);
    return data || [];
  }

  async addException(psychologistId: string, date: string, desc: string, startTime?: string, endTime?: string) {
    const payload: any = {
      psychologist_id: psychologistId, 
      exception_date: date, 
      description: desc 
    };

    if (startTime && endTime) {
      payload.start_time = startTime;
      payload.end_time = endTime;
    }

    const { data, error } = await this.supabase
      .from('psychologist_exceptions')
      .insert(payload)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  async deleteException(id: string) {
    const { error } = await this.supabase
      .from('psychologist_exceptions')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    return true;
  }
}
