import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AgendaService } from '../../../core/services/agenda.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppointmentModalComponent } from './appointment-modal/appointment-modal.component';
import { FeedbackModalComponent } from '../../../shared/components/feedback-modal/feedback-modal.component';
import { AiTriageMockService, UrgencyLevel } from '../../../core/services/ai-triage-mock.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-student-agenda',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule, MatDialogModule],
  templateUrl: './student-agenda.component.html',
  styleUrls: ['./student-agenda.component.scss']
})
export class StudentAgendaComponent implements OnInit {
  agendaService = inject(AgendaService);
  authService = inject(AuthService);
  aiMock = inject(AiTriageMockService);
  supabase = inject(SupabaseService).supabase;
  dialog = inject(MatDialog);

  urgencyLevel = this.aiMock.currentUrgency;

  // Combo box de selección de servicio unificado en el mismo calendario
  selectedSpecialty: 'psychologist' | 'nutritionist' = 'psychologist';

  // Calendar State
  currentDate = new Date();
  viewDate = new Date();
  calendarDays: { date: Date; isCurrentMonth: boolean; hasSlots: boolean; status?: string }[] = [];
  
  availableDaysMap = new Map<string, any>(); // dateStr -> info
  hasActiveReservation = false;
  activeReservationDetails: any = null;

  selectedDateStr = signal<string | null>(null);
  
  availableSlots = computed(() => {
    const dateStr = this.selectedDateStr();
    if (!dateStr) return [];
    const info = this.availableDaysMap.get(dateStr);
    return info ? info.slots.filter((s: any) => s.status !== 'taken') : [];
  });

  assignedProfessionalId: string | null = null;
  professionalName: string = '';
  professionalEmail: string = '';
  professionalAvatar: string = '';
  professionalLocation: string = '';
  professionalModality: string = 'virtual';
  professionalBuilding: string = '';
  professionalOfficeRoom: string = '';
  professionalFacultyName: string = '';
  professionalVirtualTourUrl: string = '';
  professionalRoleTitle: string = 'Psicólogo';
  
  loading = true;
  errorMsg: string | null = null;

  availableProfessionals: any[] = [];
  bookingPolicyStatus: any = null;
  policyTrackingRecord: any = null;
  studentFaculty: string = '';
  nextSessionTasks: string = '';
  phq9Pending = false;

  async ngOnInit() {
    this.generateCalendar(); 
    await this.checkPhq9Requirement();
    if (!this.phq9Pending) {
      await this.initAgenda(true);
    } else {
      this.loading = false;
    }
  }

  async checkPhq9Requirement() {
    const user = this.authService.currentUser();
    if (!user) return;
    try {
      const { data, error } = await this.supabase
        .from('diary_entries')
        .select('id')
        .eq('student_id', user.id)
        .eq('entry_type', 'phq9')
        .limit(1);
      
      if (!error) {
        this.phq9Pending = (!data || data.length === 0);
      }
    } catch (e) {
      console.warn('Error al verificar requerimiento PHQ-9, asumiendo completado:', e);
      this.phq9Pending = false;
    }
  }

  async onSpecialtyChange() {
    this.professionalRoleTitle = this.selectedSpecialty === 'psychologist' ? 'Psicólogo' : 'Nutriólogo';
    this.selectedDateStr.set(null);
    this.assignedProfessionalId = null;
    this.availableProfessionals = [];
    this.errorMsg = null;
    this.loading = true;
    await this.initAgenda(true);
  }

  async initAgenda(showAlert: boolean = true) {
    try {
      await this.fetchAssignedProfessional(showAlert);
      if (this.assignedProfessionalId) {
        await this.loadAvailability();
      } else if (this.availableProfessionals.length === 0) {
        if (!this.errorMsg) {
          this.errorMsg = `No se encontró ningún ${this.professionalRoleTitle.toLowerCase()} disponible en tu facultad.`;
        }
        this.loading = false;
      } else {
        this.loading = false;
      }

      // ponytail: Fetch last completed appointment to extract tasks/activities for the next session
      const user = this.authService.currentUser();
      if (user) {
        const { data: lastCompletedAppt } = await this.supabase
          .from('appointments')
          .select('notes')
          .eq('student_id', user.id)
          .eq('status', 'completed')
          .order('scheduled_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastCompletedAppt && lastCompletedAppt.notes) {
          const tasksMatch = lastCompletedAppt.notes.match(/<div class="next-session-tasks-content">([\s\S]*?)<\/div>/);
          if (tasksMatch) {
            this.nextSessionTasks = tasksMatch[1].trim();
          } else {
            this.nextSessionTasks = '';
          }
        } else {
          this.nextSessionTasks = '';
        }
      }
    } catch (e) {
      console.error('Error inicializando agenda:', e);
      this.errorMsg = 'Ocurrió un error al cargar la agenda.';
      this.loading = false;
    }
  }

  async fetchAssignedProfessional(showAlert: boolean) {
    const user = this.authService.currentUser();
    if (!user) return;
    this.studentFaculty = user.faculty || '';
    this.professionalRoleTitle = this.selectedSpecialty === 'psychologist' ? 'Psicólogo' : 'Nutriólogo';

    const selectField = this.selectedSpecialty === 'psychologist' ? 'primary_psychologist_id' : 'primary_nutritionist_id';

    const { data: record, error } = await this.supabase
      .from('student_clinical_records')
      .select(selectField)
      .eq('student_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error buscando profesional tratante:', error);
    }

    let profId = null;

    if (record) {
      profId = this.selectedSpecialty === 'psychologist' ? (record as any).primary_psychologist_id : (record as any).primary_nutritionist_id;
    }

    if (!profId && this.selectedSpecialty === 'psychologist' && this.urgencyLevel() === 'alto_riesgo') {
      const { data: fallback } = await this.supabase
        .from('health_professional_settings')
        .select('professional_id')
        .limit(1)
        .maybeSingle();
      
      if (fallback) profId = fallback.professional_id;
    }

    if (profId) {
      this.assignedProfessionalId = profId;
      const { data: prof } = await this.supabase.from('profiles').select('first_name, last_name, avatar_url').eq('user_id', profId).maybeSingle();
      if (prof) {
        this.professionalName = `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || `${this.professionalRoleTitle} Asignado`;
        this.professionalEmail = this.selectedSpecialty === 'psychologist' ? 'contacto@psicologia.buap.mx' : 'contacto@nutricion.buap.mx';
        this.professionalAvatar = prof.avatar_url || '';
      }

      const { data: settRaw } = await this.supabase.from('health_professional_settings').select('location, modality, building, office_room, faculties(name, virtual_tour_url)').eq('professional_id', profId).maybeSingle();
      const sett: any = settRaw;
      if (sett) {
        this.professionalLocation = sett.location || 'Consultorio Virtual';
        this.professionalModality = sett.modality || 'virtual';
        this.professionalBuilding = sett.building || '';
        this.professionalOfficeRoom = sett.office_room || '';
        const fac = sett.faculties || sett.faculty;
        this.professionalFacultyName = fac ? (Array.isArray(fac) ? fac[0]?.name : fac?.name) : '';
        this.professionalVirtualTourUrl = fac ? (Array.isArray(fac) ? fac[0]?.virtual_tour_url : fac?.virtual_tour_url) : '';
      }
    } else {
      if (showAlert) {
        this.showFeedback('error', `¡${this.professionalRoleTitle} No Asignado!`, `No tienes un ${this.professionalRoleTitle.toLowerCase()} asignado en tu expediente. Por favor, selecciona uno del directorio de tu facultad a continuación.`);
      }
      await this.loadProfessionalsByFaculty();
    }
  }

  async loadProfessionalsByFaculty() {
    if (!this.studentFaculty) {
      this.errorMsg = "No tienes una facultad asignada. Ve a configuración para asignarte una.";
      return;
    }

    const targetRoleId = this.selectedSpecialty === 'psychologist' ? 3 : 4;

    const { data, error } = await this.supabase
      .from('users')
      .select('id, role_id, profiles(first_name, last_name, avatar_url, faculty)')
      .eq('role_id', targetRoleId);

    if (data) {
      this.availableProfessionals = data.map(u => {
        const p = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles;
        return {
          id: u.id,
          name: `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Especialista',
          avatar: p?.avatar_url || '',
          faculty: p?.faculty || ''
        };
      }).filter(p => p.faculty === this.studentFaculty);
      
      if (this.availableProfessionals.length === 0) {
        this.errorMsg = `No hay ${this.professionalRoleTitle.toLowerCase()}s disponibles en tu facultad (${this.studentFaculty}) actualmente.`;
      }
    }
  }

  async requestProfessional(profId: string) {
    const user = this.authService.currentUser();
    if (!user) return;
    this.loading = true;

    try {
      const period = this.agendaService.getCurrentAcademicPeriod();
      const tracking = await this.agendaService.ensurePolicyTracking(user.id, period);

      const isPsych = this.selectedSpecialty === 'psychologist';
      const changeField = isPsych ? 'specialist_changes_psychologist' : 'specialist_changes_nutritionist';
      const changeCount = tracking ? (tracking[changeField] || 0) : 0;

      // 1. Check if there is an existing specialist assigned to detect if this is a change
      const selectField = isPsych ? 'primary_psychologist_id' : 'primary_nutritionist_id';
      const { data: record } = await this.supabase
        .from('student_clinical_records')
        .select(selectField)
        .eq('student_id', user.id)
        .maybeSingle();

      const oldProfId = record ? (record as any)[selectField] : null;
      const isRealChange = oldProfId && oldProfId !== profId;

      if (isRealChange) {
        if (changeCount >= 2) {
          this.showFeedback('error', 'Límite de Cambios de Especialista', `Has alcanzado el límite máximo de 2 cambios de ${this.professionalRoleTitle.toLowerCase()} para el periodo académico ${period}. Para cambios adicionales, solicita apoyo en administración.`);
          this.loading = false;
          return;
        }
      }

      // 2. Perform assignment/reassignment
      const updateField = isPsych ? { primary_psychologist_id: profId } : { primary_nutritionist_id: profId };
      const { error } = await this.supabase
        .from('student_clinical_records')
        .update(updateField)
        .eq('student_id', user.id);

      if (error) throw error;

      // 3. If it was a change, update tracking counter and notify previous specialist
      if (isRealChange) {
        const newCount = changeCount + 1;
        await this.agendaService.updatePolicyTracking(user.id, period, {
          [changeField]: newCount
        });

        // Notify previous specialist to write Treatment Closure Note
        try {
          const studentName = user.name || 'Estudiante';
          await this.supabase.from('professional_notifications').insert({
            professional_id: oldProfId,
            student_id: user.id,
            event_type: 'treatment_closure_needed',
            message: `El paciente ${studentName} ha solicitado cambio de especialista. Por favor, redacte la nota de cierre de tratamiento para transferir el caso.`
          });
        } catch (notifyErr) {
          console.warn('No se pudo notificar al médico anterior:', notifyErr);
        }
      }

      this.showFeedback('success', `${this.professionalRoleTitle} Asignado`, 'Se te ha asignado al especialista correctamente. Ya puedes agendar citas en el calendario unificado.');
      this.availableProfessionals = [];
      await this.fetchAssignedProfessional(false);
      if (this.assignedProfessionalId) await this.loadAvailability();
    } catch (e: any) {
      console.error('Error asignando profesional:', e);
      this.showFeedback('error', 'Error', `No se pudo asignar el ${this.professionalRoleTitle.toLowerCase()}. Asegúrate de tener tu expediente inicializado.`);
      this.loading = false;
    }
  }

  async autoAssignProfessional() {
    if (this.availableProfessionals.length > 0) {
       await this.requestProfessional(this.availableProfessionals[0].id);
    }
  }

  async loadAvailability() {
    if (!this.assignedProfessionalId) return;
    this.loading = true;
    this.errorMsg = null;
    
    try {
      const user = this.authService.currentUser();
      if (user) {
        this.bookingPolicyStatus = await this.agendaService.verifyBookingStatus(user.id, this.assignedProfessionalId);
        this.policyTrackingRecord = await this.agendaService.getPolicyTracking(user.id, this.bookingPolicyStatus.period);

        if (!this.bookingPolicyStatus.allowed && this.bookingPolicyStatus.reason === 'dropout') {
          const nextP = this.bookingPolicyStatus.period.includes('Primavera') 
            ? `Otoño ${this.bookingPolicyStatus.period.split(' ')[1]}` 
            : `Primavera ${parseInt(this.bookingPolicyStatus.period.split(' ')[1], 10) + 1}`;
          this.errorMsg = `Tu cuenta se encuentra en estado de BAJA temporal debido al incumplimiento de las políticas de asistencia, reagendas o inactividad. Podrás volver a solicitar cita a partir del siguiente periodo académico (${nextP}).`;
          this.loading = false;
          return;
        }
      }

      const startStr = new Date().toISOString().split('T')[0];
      const endObj = new Date();
      endObj.setMonth(endObj.getMonth() + 3);
      const endStr = endObj.toISOString().split('T')[0];

      const slotsData = await this.agendaService.getStudentAvailableSlots(
        this.assignedProfessionalId,
        startStr,
        endStr,
        this.urgencyLevel()
      );

      this.availableDaysMap = slotsData.daysMap;
      this.hasActiveReservation = slotsData.hasActiveReservation;
      this.activeReservationDetails = slotsData.activeReservationDetails;
      this.generateCalendar();
    } catch (e) {
      console.error('Error cargando slots:', e);
    } finally {
      this.loading = false;
    }
  }

  changeUrgency(level: UrgencyLevel) {
    this.aiMock.setUrgency(level);
    this.selectedDateStr.set(null);
    this.loadAvailability();
  }

  generateCalendar() {
    const year = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: any[] = [];
    const startingDay = firstDay.getDay(); 
    
    for (let i = 0; i < startingDay; i++) {
      const d = new Date(year, month, -startingDay + i + 1);
      days.push({ date: d, isCurrentMonth: false, hasSlots: false, status: 'off' });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      const info = this.availableDaysMap.get(dateStr);
      days.push({ 
        date: d, 
        isCurrentMonth: true, 
        status: info ? info.status : 'off',
        hasSlots: info ? info.status === 'available' : false 
      });
    }

    const remaining = (Math.ceil(days.length / 7) * 7) - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, hasSlots: false, status: 'off' });
    }

    this.calendarDays = days;
  }

  prevMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
    this.generateCalendar();
  }

  nextMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
    this.generateCalendar();
  }

  selectDay(day: any) {
    if (!day.hasSlots) return;
    const dateStr = day.date.getFullYear() + '-' + String(day.date.getMonth()+1).padStart(2,'0') + '-' + String(day.date.getDate()).padStart(2,'0');
    this.selectedDateStr.set(dateStr);
  }

  openModal(slot: any) {
    if (this.hasActiveReservation && slot.status === 'available') {
      this.showFeedback('error', 'Cita Activa', `Ya tienes una cita programada con tu ${this.professionalRoleTitle.toLowerCase()}. No puedes agendar otra hasta que asistas o canceles.`);
      return;
    }

    if (this.bookingPolicyStatus && !this.bookingPolicyStatus.allowed && slot.status === 'available') {
      if (this.bookingPolicyStatus.reason === 'session_limit_exceeded') {
        this.showFeedback('error', 'Límite de Sesiones Superado', `Has completado el límite máximo de 10 sesiones con este especialista en el periodo académico actual (${this.bookingPolicyStatus.period}). Tu especialista debe desactivar el límite si se considera de gravedad.`);
        return;
      }
    }

    const [h, m] = slot.time.split(':').map(Number);
    const endD = new Date(2000, 1, 1, h, m + 60); 
    const endStr = endD.toTimeString().substring(0, 5);

    const dialogRef = this.dialog.open(AppointmentModalComponent, {
      width: '500px',
      data: {
        psychologistName: this.professionalName,
        psychologistEmail: this.professionalEmail,
        psychologistAvatar: this.professionalAvatar,
        location: this.professionalLocation,
        modality: this.professionalModality,
        building: this.professionalBuilding,
        officeRoom: this.professionalOfficeRoom,
        facultyName: this.professionalFacultyName,
        virtualTourUrl: this.professionalVirtualTourUrl,
        dateStr: this.selectedDateStr()!,
        startTime: slot.time,
        endTime: endStr,
        status: slot.status,
        id: slot.id,
        professionalRoleTitle: this.professionalRoleTitle
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (result.action === 'book') {
          this.executeBooking(slot.time, endStr);
        } else if (result.action === 'cancel' && result.id) {
          this.executeCancellation(result.id, result.reason);
        }
      }
    });
  }

  openCancelModalDirect(details: any) {
    const dialogRef = this.dialog.open(AppointmentModalComponent, {
      width: '500px',
      data: {
        psychologistName: this.professionalName,
        psychologistEmail: this.professionalEmail,
        psychologistAvatar: this.professionalAvatar,
        location: this.professionalLocation,
        modality: this.professionalModality,
        building: this.professionalBuilding,
        officeRoom: this.professionalOfficeRoom,
        facultyName: this.professionalFacultyName,
        virtualTourUrl: this.professionalVirtualTourUrl,
        dateStr: details.date,
        startTime: details.time,
        endTime: details.time,
        status: 'my_reservation',
        id: details.id,
        professionalRoleTitle: this.professionalRoleTitle
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (result.action === 'cancel' && result.id) {
          this.executeCancellation(result.id, result.reason);
        }
      }
    });
  }

  async executeBooking(slotTime: string, endStr: string) {
    if (!this.assignedProfessionalId || !this.selectedDateStr()) return;
    const dateStr = this.selectedDateStr()!;
    const user = this.authService.currentUser();
    if (!user) return;

    this.loading = true;
    const { error } = await this.supabase.from('appointments').insert({
      student_id: user.id,
      professional_id: this.assignedProfessionalId,
      scheduled_date: dateStr,
      start_time: slotTime.length === 5 ? slotTime + ':00' : slotTime,
      end_time: endStr,
      status: 'scheduled'
    });

    if (error) {
      console.error(error);
      this.showFeedback('error', 'Error de Conexión', 'Ocurrió un error: ' + error.message);
      this.loading = false;
    } else {
      // Notificar al personal médico insertando una notificación en la base de datos
      try {
        const studentName = user.name || 'Estudiante';
        await this.supabase.from('professional_notifications').insert({
          professional_id: this.assignedProfessionalId,
          student_id: user.id,
          event_type: 'appointment_booked',
          message: `El paciente ${studentName} ha agendado una cita para el ${this.formatSpanishDate(dateStr)} a las ${slotTime.substring(0,5)}.`
        });
      } catch (e) {
        console.warn('No se pudo insertar la notificación para el médico:', e);
      }

      this.showFeedback('success', '¡Cita Confirmada!', `Tu reserva con el ${this.professionalRoleTitle.toLowerCase()} ha sido guardada exitosamente.`);
      this.selectedDateStr.set(null);
      this.loadAvailability();
    }
  }

  async executeCancellation(appointmentId: string, reason: string = 'Sin motivo especificado') {
    this.loading = true;
    const user = this.authService.currentUser();
    if (!user) return;

    try {
      // 1. Fetch appointment details to check the 72 hour rule
      const { data: appt, error: apptError } = await this.supabase
        .from('appointments')
        .select('scheduled_date, start_time')
        .eq('id', appointmentId)
        .single();

      if (apptError) throw apptError;

      // Calculate diff in hours
      const apptDateTime = new Date(`${appt.scheduled_date}T${appt.start_time || '00:00:00'}`);
      const now = new Date();
      const diffMs = apptDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      const isLateCancellation = diffHours >= 0 && diffHours < 72;

      // 2. Perform cancellation
      const { error: cancelError } = await this.supabase
        .from('appointments')
        .update({ status: 'cancelled', cancellation_reason: reason })
        .eq('id', appointmentId);

      if (cancelError) throw cancelError;

      let msg = `Tu cita con el ${this.professionalRoleTitle.toLowerCase()} ha sido cancelada correctamente y el espacio fue liberado.`;

      // 3. Handle late cancellation policy
      if (isLateCancellation) {
        const period = this.agendaService.getCurrentAcademicPeriod(appt.scheduled_date);
        const tracking = await this.agendaService.ensurePolicyTracking(user.id, period);
        const lateCount = (tracking?.late_cancellations || 0) + 1;

        await this.agendaService.updatePolicyTracking(user.id, period, {
          late_cancellations: lateCount
        });

        if (lateCount >= 3) {
          await this.supabase
            .from('patient_settings')
            .update({ status: 'dropout' })
            .eq('student_id', user.id);
          
          this.showFeedback('error', 'Sanción de Baja Aplicada', 'Has cancelado 3 citas con menos de 72 horas de anticipación. Por reglamento, tu cuenta ha sido suspendida (BAJA) por el resto del periodo académico.');
          this.selectedDateStr.set(null);
          this.loading = false;
          await this.initAgenda(false);
          return;
        } else {
          msg = `Tu cita ha sido cancelada. AVISO: Esta cancelación se realizó con menos de 72 horas de anticipación (${lateCount}/3 permitidas). Acumular 3 cancelaciones tardías causa BAJA del servicio.`;
        }
      }

      this.showFeedback('success', 'Cita Cancelada', msg);
      this.selectedDateStr.set(null);
      await this.loadAvailability();
    } catch (e: any) {
      console.error('Error al cancelar cita:', e);
      this.showFeedback('error', 'Error al Cancelar', 'Ocurrió un error: ' + e.message);
      this.loading = false;
    }
  }

  showFeedback(type: 'success' | 'error', title: string, message: string) {
    this.dialog.open(FeedbackModalComponent, {
      width: '400px',
      data: { type, title, message }
    });
  }

  get monthYear() {
    return this.viewDate.toLocaleString('es', { month: 'long', year: 'numeric' });
  }

  formatSpanishDate(dateStr: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr.substring(0, 10) + 'T12:00:00');
    return new Intl.DateTimeFormat('es-MX', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    }).format(d);
  }

  isToday(d: Date) {
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }
}
