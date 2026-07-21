import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AgendaService } from '../../../core/services/agenda.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { EmergencyChangeModalComponent } from './emergency-change-modal/emergency-change-modal.component';
import { EmergencyNotificationService } from '../../../core/services/emergency-notification.service';
import { FeedbackModalComponent } from '../../../shared/components/feedback-modal/feedback-modal.component';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  hasAppointments: boolean;
  isBlocked: boolean;
}

@Component({
  selector: 'app-health-professional-agenda',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule, RouterModule, MatDialogModule],
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.scss']
})
export class HealthProfessionalAgendaComponent implements OnInit {
  authService = inject(AuthService);
  agendaService = inject(AgendaService);
  supabase = inject(SupabaseService).supabase;
  dialog = inject(MatDialog);
  emergencyNotificationService = inject(EmergencyNotificationService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  crypto = inject(CryptoService);

  currentDate = new Date();
  calendarDays: CalendarDay[] = [];
  
  viewMode: 'days' | 'months' = 'days';
  monthsList = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  selectedDate: Date | null = null;
  dayAppointments: any[] = [];
  dayBlocks: any[] = []; 
  dayExceptions: any[] = []; 
  timelineItems: any[] = []; // Array cronológico

  // Búsqueda
  searchQuery = '';
  searchResults: any[] | null = null;

  isLoading = true;

  // ponytail: Agendamiento clínico directo
  studentId: string | null = null;
  studentName: string = '';
  studentRiskLevel: string = 'Bajo';
  bookingViewDate = new Date();
  bookingCalendarDays: any[] = [];
  bookingAvailableSlots: any[] = [];
  selectedBookingDateStr: string | null = null;
  selectedSlot: any = null;
  showProportionalityWarning = false;
  isSubmittingBooking = false;
  availableDaysMap = new Map<string, any>();

  // ponytail: Banner de composición de Triage
  triageStats = { high: 0, moderate: 0, low: 0 };

  get monthYearString(): string {
    if (this.viewMode === 'months') return this.currentDate.getFullYear().toString();
    return this.currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }

  get currentUserId() { return this.authService.currentUser()?.id; }

  get isNutritionist(): boolean {
    return this.authService.currentUser()?.role === 'Nutricionista';
  }

  get professionalTitle(): string {
    return this.isNutritionist ? 'Nutricionista' : 'Psicólogo';
  }

  get profileRoutePrefix(): string {
    return this.isNutritionist ? '/nutritionist/pacientes' : '/psychologist/patients';
  }

  async ngOnInit() {
    this.selectedDate = new Date();
    await this.generateCalendar();
    await this.loadDayDetails(this.selectedDate);

    // ponytail: Cargar estadísticas del triage asignados
    await this.loadTriageStats();

    // ponytail: Escuchar si viene studentId para reserva
    this.route.queryParams.subscribe(async params => {
      this.studentId = params['studentId'] || null;
      if (this.studentId) {
        await this.loadStudentDetails(this.studentId);
        await this.generateBookingCalendar();
      }
    });

    this.isLoading = false;
  }

  // ponytail: Calcular cuántos alumnos asignados por riesgo
  async loadTriageStats() {
    if (!this.currentUserId) return;
    const filterField = this.isNutritionist ? 'primary_nutritionist_id' : 'primary_psychologist_id';

    try {
      const { data, error } = await this.supabase
        .from('student_clinical_records')
        .select('known_conditions, additional_notes')
        .eq(filterField, this.currentUserId);

      if (error) {
        console.error('Error cargando estadísticas de triaje:', error);
        return;
      }

      let high = 0;
      let moderate = 0;
      let low = 0;

      if (data) {
        data.forEach((r: any) => {
          let hasEatRisk = false;
          if (r.additional_notes) {
            try {
              const decrypted = this.crypto.decrypt(r.additional_notes);
              const parsed = JSON.parse(decrypted);
              if (parsed.q1) {
                let score = 0;
                let hasBehavioralRisk = false;
                const scoreMapNormal: any = { 'Siempre': 3, 'Casi siempre': 2, 'A menudo': 1, 'A veces': 0, 'Rara vez': 0, 'Nunca': 0 };
                const scoreMapQ26: any = { 'Siempre': 0, 'Casi siempre': 0, 'A menudo': 0, 'A veces': 1, 'Rara vez': 2, 'Nunca': 3 };
                for (let i = 1; i <= 26; i++) {
                  const ans = parsed['q' + i];
                  if (ans) {
                    score += (i === 26) ? (scoreMapQ26[ans] || 0) : (scoreMapNormal[ans] || 0);
                  }
                }
                const behavioralIds = ['bA', 'bB', 'bC', 'bD'];
                behavioralIds.forEach(id => {
                   if (parsed[id] && parsed[id] !== 'Nunca' && parsed[id] !== 'No') {
                      hasBehavioralRisk = true;
                   }
                });
                if (parsed['bE'] === 'Sí') hasBehavioralRisk = true;

                if (score >= 20 || hasBehavioralRisk) {
                  hasEatRisk = true;
                }
              }
            } catch (e) {
              // ignore
            }
          }

          const conditions = r.known_conditions || [];
          if (hasEatRisk) {
            high++;
          } else if (conditions.length > 0) {
            moderate++;
          } else {
            low++;
          }
        });
      }

      this.triageStats = { high, moderate, low };
    } catch (e) {
      console.error(e);
    }
  }

  // ponytail: Obtener detalles del estudiante a agendar
  async loadStudentDetails(studentId: string) {
    try {
      const { data: userData, error } = await this.supabase
        .from('users')
        .select('id, profiles(first_name, last_name), student_clinical_records!student_clinical_records_student_id_fkey(known_conditions, additional_notes)')
        .eq('id', studentId)
        .single();

      if (error || !userData) {
        console.error('Error loading student details:', error);
        this.studentName = 'Estudiante';
        return;
      }

      const p = Array.isArray(userData.profiles) ? userData.profiles[0] : userData.profiles;
      this.studentName = `${p?.first_name || 'Estudiante'} ${p?.last_name || ''}`.trim();

      const records = userData.student_clinical_records;
      const recordObj = Array.isArray(records) ? records[0] : records;
      const conditions = recordObj?.known_conditions || [];
      let hasEatRisk = false;

      if (recordObj?.additional_notes) {
        try {
          const decrypted = this.crypto.decrypt(recordObj.additional_notes);
          const parsed = JSON.parse(decrypted);
          if (parsed.q1) {
            let score = 0;
            let hasBehavioralRisk = false;
            const scoreMapNormal: any = { 'Siempre': 3, 'Casi siempre': 2, 'A menudo': 1, 'A veces': 0, 'Rara vez': 0, 'Nunca': 0 };
            const scoreMapQ26: any = { 'Siempre': 0, 'Casi siempre': 0, 'A menudo': 0, 'A veces': 1, 'Rara vez': 2, 'Nunca': 3 };
            for (let i = 1; i <= 26; i++) {
              const ans = parsed['q' + i];
              if (ans) {
                score += (i === 26) ? (scoreMapQ26[ans] || 0) : (scoreMapNormal[ans] || 0);
              }
            }
            const behavioralIds = ['bA', 'bB', 'bC', 'bD'];
            behavioralIds.forEach(id => {
               if (parsed[id] && parsed[id] !== 'Nunca' && parsed[id] !== 'No') {
                  hasBehavioralRisk = true;
               }
            });
            if (parsed['bE'] === 'Sí') hasBehavioralRisk = true;

            if (score >= 20 || hasBehavioralRisk) {
              hasEatRisk = true;
            }
          }
        } catch (e) {
          // ignore
        }
      }

      this.studentRiskLevel = hasEatRisk ? 'Alto' : (conditions.length > 0 ? 'Moderado' : 'Bajo');
    } catch (e) {
      console.error(e);
    }
  }

  // ponytail: Calendario de Reserva
  async generateBookingCalendar() {
    if (!this.currentUserId) return;

    const year = this.bookingViewDate.getFullYear();
    const month = this.bookingViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

    // Obtener disponibilidad ordinaria (ignorando ciegos)
    const slotsData = await this.agendaService.getStudentAvailableSlots(this.currentUserId, startStr, endStr, 'alto_riesgo');

    this.availableDaysMap = slotsData.daysMap || new Map();

    this.bookingCalendarDays = [];
    let startDayOfWeek = firstDay.getDay() - 1; 
    if (startDayOfWeek === -1) startDayOfWeek = 6; 

    // Rellenar días anteriores
    for (let i = startDayOfWeek; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      this.bookingCalendarDays.push({ date: d, isCurrentMonth: false, hasSlots: false });
    }

    // Días del mes actual
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const dayInfo = this.availableDaysMap.get(dateStr);
      const hasSlots = dayInfo && dayInfo.status === 'available' && dayInfo.slots.some((s: any) => s.status === 'available');

      this.bookingCalendarDays.push({ 
        date: d, 
        isCurrentMonth: true, 
        hasSlots: hasSlots 
      });
    }

    // Rellenar días posteriores
    const remainingDays = 42 - this.bookingCalendarDays.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      this.bookingCalendarDays.push({ date: d, isCurrentMonth: false, hasSlots: false });
    }
  }

  async prevBookingMonth() {
    this.bookingViewDate = new Date(this.bookingViewDate.getFullYear(), this.bookingViewDate.getMonth() - 1, 1);
    this.selectedBookingDateStr = null;
    this.selectedSlot = null;
    this.bookingAvailableSlots = [];
    await this.generateBookingCalendar();
  }

  async nextBookingMonth() {
    this.bookingViewDate = new Date(this.bookingViewDate.getFullYear(), this.bookingViewDate.getMonth() + 1, 1);
    this.selectedBookingDateStr = null;
    this.selectedSlot = null;
    this.bookingAvailableSlots = [];
    await this.generateBookingCalendar();
  }

  getFormattedDateStr(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  selectBookingDay(day: any) {
    if (!day.hasSlots) return;

    this.selectedBookingDateStr = this.getFormattedDateStr(day.date);
    const dayInfo = this.availableDaysMap.get(this.selectedBookingDateStr);
    this.bookingAvailableSlots = dayInfo ? dayInfo.slots.filter((s: any) => s.status === 'available') : [];
    this.selectedSlot = null;
    this.showProportionalityWarning = false;
  }

  selectSlot(slot: any) {
    this.selectedSlot = slot;
    if (this.selectedBookingDateStr) {
      this.showProportionalityWarning = this.isProportionalitySlot(this.selectedBookingDateStr);
    }
  }

  isProportionalitySlot(dateStr: string): boolean {
    const today = new Date();
    today.setHours(0,0,0,0);
    const date = new Date(dateStr + 'T00:00:00');
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (this.studentRiskLevel === 'Alto') return false;
    if (this.studentRiskLevel === 'Moderado' && diffDays < 2) return true;
    if (this.studentRiskLevel === 'Bajo' && diffDays < 7) return true;
    return false;
  }

  getRiskBadgeClass(risk: string): string {
    if (risk === 'Alto') return 'badge-danger';
    if (risk === 'Moderado') return 'badge-warning';
    return 'badge-success';
  }

  async confirmClinicalBooking() {
    if (!this.studentId || !this.currentUserId || !this.selectedBookingDateStr || !this.selectedSlot) return;

    this.isSubmittingBooking = true;
    try {
      const endTime = this.calculateEndTime(this.selectedSlot.time);
      const { error } = await this.supabase
        .from('appointments')
        .insert({
          student_id: this.studentId,
          professional_id: this.currentUserId,
          scheduled_date: this.selectedBookingDateStr,
          start_time: this.selectedSlot.time,
          end_time: endTime,
          status: 'scheduled'
        });

      if (error) {
        console.error('Error al agendar:', error);
        alert('Error al agendar: ' + error.message);
      } else {
        this.dialog.open(FeedbackModalComponent, {
          width: '380px',
          data: {
            type: 'success',
            title: 'Cita Agendada',
            message: `Cita con ${this.studentName} el ${this.selectedBookingDateStr} a las ${this.selectedSlot.time} agendada correctamente.`
          }
        });

        // Limpiar query params y volver a expediente
        this.cancelClinicalBooking();
      }
    } catch (e: any) {
      console.error(e);
      alert('Error inesperado: ' + e.message);
    } finally {
      this.isSubmittingBooking = false;
    }
  }

  calculateEndTime(startTime: string): string {
    const [h, m] = startTime.split(':').map(Number);
    let endM = m + 50;
    let endH = h;
    if (endM >= 60) {
      endM -= 60;
      endH += 1;
    }
    return `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}:00`;
  }

  cancelClinicalBooking() {
    if (this.studentId) {
      const redirectPath = this.isNutritionist 
        ? `/nutritionist/pacientes/${this.studentId}` 
        : `/psychologist/patients/${this.studentId}`;
      this.router.navigate([redirectPath]);
    }
  }

  async generateCalendar() {
    this.calendarDays = [];
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startDayOfWeek = firstDay.getDay() - 1; 
    if (startDayOfWeek === -1) startDayOfWeek = 6; 

    // Fechas anteriores para rellenar
    for (let i = startDayOfWeek; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      this.calendarDays.push({ date: d, isCurrentMonth: false, hasAppointments: false, isBlocked: false });
    }

    // Fechas del mes actual
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      this.calendarDays.push({ date: d, isCurrentMonth: true, hasAppointments: false, isBlocked: false });
    }

    // Rellenar hasta completar grilla de 42 celdas
    const remainingDays = 42 - this.calendarDays.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      this.calendarDays.push({ date: d, isCurrentMonth: false, hasAppointments: false, isBlocked: false });
    }
  }

  async previousMonth() {
    if (this.viewMode === 'days') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    } else {
      this.currentDate = new Date(this.currentDate.getFullYear() - 1, this.currentDate.getMonth(), 1);
    }
    await this.generateCalendar();
  }

  async nextMonth() {
    if (this.viewMode === 'days') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    } else {
      this.currentDate = new Date(this.currentDate.getFullYear() + 1, this.currentDate.getMonth(), 1);
    }
    await this.generateCalendar();
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'days' ? 'months' : 'days';
  }

  async selectMonth(index: number) {
    this.currentDate = new Date(this.currentDate.getFullYear(), index, 1);
    this.viewMode = 'days';
    await this.generateCalendar();
  }

  async selectDate(day: CalendarDay) {
    this.selectedDate = day.date;
    this.searchResults = null; // Quitar vista de búsqueda
    this.searchQuery = '';
    this.isLoading = true;
    await this.loadDayDetails(this.selectedDate);
    this.isLoading = false;
  }

  async performSearch() {
    if (!this.searchQuery.trim() || !this.currentUserId) {
      this.searchResults = null;
      return;
    }
    
    this.isLoading = true;
    
    const { data, error } = await this.supabase
      .from('appointments')
      .select('*, student:users!appointments_student_id_fkey(profiles(first_name, last_name, avatar_url)), session_evaluations(q1_global, q2_bond, q3_goals, q4_impact, score_global, rupture_flag)')
      .eq('professional_id', this.currentUserId)
      .order('scheduled_date', { ascending: false });

    if (error) {
      console.error('Error fetching appointments:', error);
      alert('Error cargando citas: ' + error.message);
      return;
    }

    if (data) {
      const q = this.searchQuery.toLowerCase();
      this.searchResults = data.filter((a: any) => {
        const fname = a.student?.profiles?.first_name?.toLowerCase() || '';
        const lname = a.student?.profiles?.last_name?.toLowerCase() || '';
        return fname.includes(q) || lname.includes(q);
      });
    } else {
      this.searchResults = [];
    }

    this.selectedDate = null; // Mostrar vista de resultados en lugar de agenda diaria
    this.isLoading = false;
  }

  async loadDayDetails(date: Date) {
    if (!this.currentUserId) return;
    
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateString = `${yyyy}-${mm}-${dd}`;
    
    const dayOfWeekNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayOfWeekNames[date.getDay()];

    // 1. Obtener horario ordinario
    const settings = await this.agendaService.getSettings(this.currentUserId);
    this.dayBlocks = [];
    if (settings && settings.working_days && settings.working_days[dayName] && settings.working_days[dayName].active) {
      this.dayBlocks = settings.working_days[dayName].blocks || [];
    }

    // 2. Obtener excepciones para ese día específico
    const { data: excs } = await this.supabase
      .from('health_professional_exceptions')
      .select('*')
      .eq('exception_date', dateString)
      .or(`professional_id.eq.${this.currentUserId},professional_id.is.null`);
      
    this.dayExceptions = excs || [];

    // 3. Obtener Citas de este día exacto con evaluaciones asociadas
    const { data: appts, error } = await this.supabase
      .from('appointments')
      .select('*, student:users!appointments_student_id_fkey(profiles(first_name, last_name, avatar_url)), session_evaluations(q1_global, q2_bond, q3_goals, q4_impact, score_global, rupture_flag)')
      .eq('professional_id', this.currentUserId)
      .eq('scheduled_date', dateString)
      .not('status', 'in', '(cancelled,canceled)')
      .order('start_time', { ascending: true });

    if (error) console.error('Error fetching appointments:', error);

    this.dayAppointments = appts || [];

    this.buildTimeline();
  }

  buildTimeline() {
    this.timelineItems = [];

    // 1. Bloques de horario base
    this.dayBlocks.forEach(b => {
      this.timelineItems.push({
        time: b.start,
        type: 'block',
        title: 'Horario Ordinario',
        desc: `Atendiendo de ${b.start} a ${b.end}`,
        data: b
      });
    });

    // 2. Excepciones
    this.dayExceptions.forEach(e => {
      const timeStart = e.start_time ? e.start_time.substring(0,5) : '00:00';
      const timeEnd = e.end_time ? e.end_time.substring(0,5) : '23:59';
      this.timelineItems.push({
        time: timeStart,
        type: 'exception',
        title: e.start_time ? `Bloqueo Parcial` : `Día Bloqueado Completo`,
        desc: e.description || 'Sin motivo especificado',
        extra: e.start_time ? `De ${timeStart} a ${timeEnd}` : 'Aplica todo el día',
        data: e
      });
    });

    // 3. Citas
    this.dayAppointments.forEach(a => {
      const time = a.start_time ? a.start_time.substring(0,5) : '00:00';
      const ev = this.getEvaluation(a);
      
      this.timelineItems.push({
        time: time,
        type: 'appointment',
        title: `Cita: ${a.student?.profiles?.first_name || 'Paciente'} ${a.student?.profiles?.last_name || ''}`,
        desc: `Estado: ${a.status === 'scheduled' ? 'Confirmada' : a.status === 'completed' ? 'Completada' : a.status}`,
        evaluation: ev,
        data: a
      });
    });

    // Ordenar cronológicamente
    this.timelineItems.sort((a, b) => {
      if (a.time < b.time) return -1;
      if (a.time > b.time) return 1;
      return 0;
    });
  }

  getEvaluation(appt: any): any {
    if (!appt || !appt.session_evaluations) return null;
    return Array.isArray(appt.session_evaluations) ? appt.session_evaluations[0] : appt.session_evaluations;
  }

  getAlertClass(flag: string): string {
    if (flag === 'critical') return 'badge-danger';
    if (flag === 'decline') return 'badge-warning';
    return 'badge-success';
  }

  getAlertText(flag: string): string {
    if (flag === 'critical') return '⚠️ Ruptura';
    if (flag === 'decline') return '📉 Caída';
    return '✅ Sólida';
  }

  openEmergencyChangeModal(appointment: any) {
    const dialogRef = this.dialog.open(EmergencyChangeModalComponent, {
      width: '640px',
      panelClass: 'emergency-dialog-container',
      data: { appointment }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        this.isLoading = true;
        const success = await this.emergencyNotificationService.sendEmergencyNotification(appointment, result);
        if (success && this.selectedDate) {
          await this.loadDayDetails(this.selectedDate);
        } else if (success && this.searchResults) {
          await this.performSearch();
        }
        this.isLoading = false;
      }
    });
  }
}

