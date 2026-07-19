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
      .from('health_professional_settings')
      .select('*, faculties(id, name, virtual_tour_url)')
      .eq('professional_id', psychologistId)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
    }
    return data as any;
  }

  async saveSettings(psychologistId: string, duration: number, workingDays: WorkingDaysMap, location: string, modality: string = 'virtual', facultyId: number | null = null, building: string = '', officeRoom: string = '') {
    const { data, error } = await this.supabase
      .from('health_professional_settings')
      .upsert({ 
        professional_id: psychologistId, 
        session_duration: duration, 
        working_days: workingDays,
        location: location || null,
        modality: modality || 'virtual',
        faculty_id: facultyId || null,
        building: building || null,
        office_room: officeRoom || null
      }, { onConflict: 'professional_id' });
    
    if (error) throw error;
    return data;
  }

  async getExceptions(psychologistId: string) {
    const { data, error } = await this.supabase
      .from('health_professional_exceptions')
      .select('*')
      .or(`professional_id.eq.${psychologistId},professional_id.is.null`)
      .order('exception_date', { ascending: true });
      
    if (error) console.error('Error fetching exceptions:', error);
    return data || [];
  }

  async addException(psychologistId: string, date: string, desc: string, startTime?: string, endTime?: string) {
    const payload: any = {
      professional_id: psychologistId, 
      exception_date: date, 
      description: desc 
    };

    if (startTime && endTime) {
      payload.start_time = startTime;
      payload.end_time = endTime;
    }

    const { data, error } = await this.supabase
      .from('health_professional_exceptions')
      .insert(payload)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  async deleteException(id: string) {
    const { error } = await this.supabase
      .from('health_professional_exceptions')
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
      this.supabase.from('appointments').select('*').eq('professional_id', psychologistId).gte('scheduled_date', startDate).lte('scheduled_date', endDate).eq('status', 'scheduled')
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
      id: activeAppointment.id,
      date: activeAppointment.scheduled_date,
      time: activeAppointment.start_time,
      modality: settings.modality || 'virtual',
      location: settings.location || 'Consultorio Virtual',
      building: settings.building || '',
      officeRoom: settings.office_room || '',
      facultyName: (settings.faculties || settings.faculty) ? (Array.isArray(settings.faculties || settings.faculty) ? (settings.faculties || settings.faculty)[0]?.name : (settings.faculties || settings.faculty)?.name) : '',
      virtualTourUrl: (settings.faculties || settings.faculty) ? (Array.isArray(settings.faculties || settings.faculty) ? (settings.faculties || settings.faculty)[0]?.virtual_tour_url : (settings.faculties || settings.faculty)?.virtual_tour_url) : ''
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
      
      const hasMyRes = availableTimes.some(t => t.status === 'my_reservation');
      let status = 'off';
      if (hasMyRes) {
        status = 'available';
      } else if (currentDate < minAllowedDate) {
        status = 'blind';
      } else if (availableTimes.length > 0) {
        status = 'available';
      } else if (workingDays[dayName] && workingDays[dayName].active) {
        status = 'full';
      }

      const hasSlots = availableTimes.some(t => t.status !== 'taken');
      availableDays.set(dateStr, { status, hasSlots: hasMyRes || hasSlots, slots: availableTimes });
    }
    
    return { daysMap: availableDays, hasActiveReservation, activeReservationDetails };
  }

  // --- Skill 18: Políticas de Consulta y Reagendas ---

  getCurrentAcademicPeriod(dateInput?: Date | string): string {
    const d = dateInput ? new Date(dateInput) : new Date();
    const term = d.getMonth() < 6 ? 'Primavera' : 'Otoño';
    return `${term} ${d.getFullYear()}`;
  }

  getPeriodDateRange(period: string) {
    const [term, yearStr] = period.split(' ');
    const year = parseInt(yearStr, 10);
    if (term === 'Primavera') {
      return {
        start: `${year}-01-01`,
        end: `${year}-06-30`
      };
    } else {
      return {
        start: `${year}-07-01`,
        end: `${year}-12-31`
      };
    }
  }

  async getPolicyTracking(studentId: string, period: string) {
    const { data, error } = await this.supabase
      .from('student_policy_tracking')
      .select('*')
      .eq('student_id', studentId)
      .eq('academic_period', period)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching policy tracking:', error);
    }
    return data;
  }

  async ensurePolicyTracking(studentId: string, period: string) {
    const existing = await this.getPolicyTracking(studentId, period);
    if (existing) return existing;

    const { data, error } = await this.supabase
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

  async updatePolicyTracking(studentId: string, period: string, updates: any) {
    await this.ensurePolicyTracking(studentId, period);
    const { data, error } = await this.supabase
      .from('student_policy_tracking')
      .update(updates)
      .eq('student_id', studentId)
      .eq('academic_period', period)
      .select()
      .single();

    if (error) {
      console.error('Error updating policy tracking:', error);
      throw error;
    }
    return data;
  }

  async countCompletedSessions(studentId: string, period: string, professionalId?: string) {
    const range = this.getPeriodDateRange(period);
    let query = this.supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .gte('scheduled_date', range.start)
      .lte('scheduled_date', range.end);
      
    if (professionalId) {
      query = query.eq('professional_id', professionalId);
    }

    const { count, error } = await query;
    if (error) {
      console.error('Error counting completed sessions:', error);
      return 0;
    }
    return count || 0;
  }

  async countNoShows(studentId: string, period: string) {
    const range = this.getPeriodDateRange(period);
    const { count, error } = await this.supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('status', 'no_show')
      .gte('scheduled_date', range.start)
      .lte('scheduled_date', range.end);

    if (error) {
      console.error('Error counting no-shows:', error);
      return 0;
    }
    return count || 0;
  }

  async checkInactivityDropout(studentId: string) {
    const { data: lastCompleted, error: lastError } = await this.supabase
      .from('appointments')
      .select('scheduled_date')
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .order('scheduled_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError || !lastCompleted) return false;

    const todayStr = new Date().toISOString().split('T')[0];
    const { data: futureAppts, error: futureError } = await this.supabase
      .from('appointments')
      .select('id')
      .eq('student_id', studentId)
      .eq('status', 'scheduled')
      .gte('scheduled_date', todayStr)
      .limit(1);

    if (futureError || (futureAppts && futureAppts.length > 0)) return false;

    const lastDate = new Date(lastCompleted.scheduled_date);
    const today = new Date();
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 30) {
      await this.supabase
        .from('patient_settings')
        .update({ status: 'dropout' })
        .eq('student_id', studentId);
      return true;
    }
    return false;
  }

  async verifyBookingStatus(studentId: string, professionalId: string) {
    const period = this.getCurrentAcademicPeriod();
    
    const { data: settings, error: settingsError } = await this.supabase
      .from('patient_settings')
      .select('status')
      .eq('student_id', studentId)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching patient settings:', settingsError);
    }

    const currentStatus = settings?.status || 'active';

    if (currentStatus === 'dropout') {
      return { allowed: false, reason: 'dropout', period };
    }

    const isInactive = await this.checkInactivityDropout(studentId);
    if (isInactive) {
      return { allowed: false, reason: 'dropout', period };
    }

    const completedCount = await this.countCompletedSessions(studentId, period, professionalId);
    const policy = await this.getPolicyTracking(studentId, period);
    const bypass = policy?.bypass_session_limit || false;

    if (completedCount >= 10 && !bypass) {
      return { 
        allowed: false, 
        reason: 'session_limit_exceeded', 
        completedCount,
        period 
      };
    }

    return { 
      allowed: true, 
      reason: 'ok', 
      completedCount, 
      bypass, 
      period 
    };
  }
}
