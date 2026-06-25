import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

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
  private authService = inject(AuthService);

  async getSettings(psychologistId: string) {
    const { data, error } = await this.supabase
      .from('psychologist_settings')
      .select('*')
      .eq('psychologist_id', psychologistId)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
    }
    return data;
  }

  async saveSettings(psychologistId: string, duration: number, workingDays: WorkingDaysMap, location: string) {
    const { data, error } = await this.supabase
      .from('psychologist_settings')
      .upsert({ 
        psychologist_id: psychologistId, 
        session_duration: duration, 
        working_days: workingDays,
        location: location || null
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

  // --- Skill 8: Lógica de Disponibilidad Híbrida para Estudiantes ---
  async getStudentAvailableSlots(psychologistId: string, startDate: string, endDate: string, urgency: string) {
    const today = new Date();
    today.setHours(0,0,0,0);
    let blindDays = 0;
    if (urgency === 'bajo_riesgo') blindDays = 7;
    if (urgency === 'medio_riesgo') blindDays = 2;
    
    const minAllowedDate = new Date(today);
    minAllowedDate.setDate(today.getDate() + blindDays);

    const [settings, exceptionsRes, appointmentsRes] = await Promise.all([
      this.getSettings(psychologistId),
      this.getExceptions(psychologistId),
      this.supabase.from('appointments').select('*').eq('psychologist_id', psychologistId).gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    ]);

    // DEBUG EXTREMO:
    const testRes = await this.supabase.from('appointments').select('*');
    console.log('🔍 TEST TODAS LAS CITAS (SIN FILTROS):', testRes.data);
    console.log('🔍 ID PSICOLOGO BUSCADO:', psychologistId);
    console.log('🔍 CITAS QUE PASARON EL FILTRO:', appointmentsRes.data);
    if (appointmentsRes.error) console.error(appointmentsRes.error);

    if (!settings) return { daysMap: new Map(), hasActiveReservation: false };
    const duration = settings.session_duration || 60;
    const workingDays: WorkingDaysMap = settings.working_days || {};
    const exceptions = exceptionsRes || [];
    const appointments = appointmentsRes.data || [];

    const result: any[] = [];
    // Forzar lectura en medianoche LOCAL para evitar desfasaje de días
    let current = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const user = this.authService.currentUser();
    const myId = user?.id;

    // Verificar si el estudiante YA TIENE una reserva activa (futura y en estado scheduled)
    const activeAppointment = appointments.find(a => 
      a.student_id === myId && a.status === 'scheduled' && new Date(a.scheduled_date) >= new Date(startDate)
    );
    const hasActiveReservation = !!activeAppointment;
    const activeReservationDetails = activeAppointment ? {
      date: activeAppointment.scheduled_date,
      time: activeAppointment.start_time
    } : null;

    const availableDays = new Map();

    for (let i = 0; i < 30; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() + i);
      const dateStr = currentDate.getFullYear() + '-' + ('0'+(currentDate.getMonth()+1)).slice(-2) + '-' + ('0'+currentDate.getDate()).slice(-2);
      
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const availableTimes: any[] = [];
      
      if (workingDays[dayName] && workingDays[dayName].active) {
        const blocks = workingDays[dayName].blocks || [];
        
        blocks.forEach((block: any) => {
             const [startH, startM] = block.start.split(':').map(Number);
             const [endH, endM] = block.end.split(':').map(Number);
             let blockStart = new Date(currentDate); blockStart.setHours(startH, startM, 0);
             const blockEnd = new Date(currentDate); blockEnd.setHours(endH, endM, 0);

             while (blockStart < blockEnd) {
                const slotTime = blockStart.toTimeString().substring(0,5);
                
                const isExcepted = exceptions.some(e => 
                  e.exception_date === dateStr && 
                  (e.start_time ? (slotTime >= e.start_time.substring(0,5) && slotTime < e.end_time.substring(0,5)) : true)
                );
                
                let slotStatus = 'available';
                let slotId = null;

                const bookedAppt = appointments.find(a => {
                  const dbDate = a.scheduled_date ? String(a.scheduled_date).substring(0, 10) : '';
                  const dbTime = a.start_time ? String(a.start_time).substring(0, 5) : '';
                  return dbDate === dateStr && dbTime === slotTime;
                });

                if (bookedAppt) {
                  slotStatus = (bookedAppt.student_id === myId) ? 'my_reservation' : 'taken';
                  if (slotStatus === 'my_reservation') {
                    slotId = bookedAppt.id;
                  }
                }

                if (!isExcepted) {
                  availableTimes.push({ time: slotTime, status: slotStatus, id: slotId });
                }
                
                blockStart.setMinutes(blockStart.getMinutes() + duration);
             }
        });
      }
      
      let status = 'off';
      if (currentDate < minAllowedDate) {
        status = 'blind';
      } else if (availableTimes.length > 0) {
        status = 'available';
      } else if (workingDays[dayName] && workingDays[dayName].active) {
        status = 'full';
      }

      const hasSlots = availableTimes.some(t => t.status !== 'taken');
      availableDays.set(dateStr, { status, hasSlots, slots: availableTimes });
    }
    
    return { daysMap: availableDays, hasActiveReservation, activeReservationDetails };
  }
}
