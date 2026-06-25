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
    // Mostrar solo los disponibles o los que son del paciente
    return info ? info.slots.filter((s: any) => s.status !== 'taken') : [];
  });

  psychologistId: string | null = null;
  psychologistName: string = '';
  psychologistEmail: string = '';
  psychologistAvatar: string = '';
  psychologistLocation: string = '';
  loading = true;
  errorMsg: string | null = null;

  availablePsychologists: any[] = [];
  studentFaculty: string = '';

  async ngOnInit() {
    this.generateCalendar(); 
    try {
      await this.fetchAssignedPsychologist();
      if (this.psychologistId) {
        await this.loadAvailability();
      } else if (this.availablePsychologists.length === 0) {
        if (!this.errorMsg) {
          this.errorMsg = 'No se encontró ningún psicólogo disponible en tu facultad.';
        }
        this.loading = false;
      } else {
        this.loading = false;
      }
    } catch (e) {
      console.error('Error inicializando agenda:', e);
      this.errorMsg = 'Ocurrió un error al cargar la agenda.';
      this.loading = false;
    }
  }

  async fetchAssignedPsychologist() {
    const user = this.authService.currentUser();
    if (!user) return;
    this.studentFaculty = user.faculty || '';

    // 1. Buscar psicólogo tratante del estudiante
    const { data: record, error } = await this.supabase
      .from('student_clinical_records')
      .select('primary_psychologist_id')
      .eq('student_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error buscando psicólogo tratante:', error);
    }

    let psyId = null;

    if (record && record.primary_psychologist_id) {
      psyId = record.primary_psychologist_id;
    } else if (this.urgencyLevel() === 'alto_riesgo') {
      // 2. Si es Alto Riesgo y NO tiene psicólogo, le asignamos uno de guardia con horarios
      const { data: fallback } = await this.supabase
        .from('psychologist_settings')
        .select('psychologist_id')
        .limit(1)
        .maybeSingle();
      
      if (fallback) psyId = fallback.psychologist_id;
    }

    if (psyId) {
      this.psychologistId = psyId;
      // Traer detalles del psicólogo para el Modal
      const { data: prof } = await this.supabase.from('profiles').select('first_name, last_name, avatar_url').eq('user_id', psyId).maybeSingle();
      if (prof) {
        this.psychologistName = `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || 'Psicólogo Asignado';
        this.psychologistEmail = 'contacto@psicologia.buap.mx';
        this.psychologistAvatar = prof.avatar_url || '';
      }

      const { data: sett } = await this.supabase.from('psychologist_settings').select('location').eq('psychologist_id', psyId).maybeSingle();
      if (sett) this.psychologistLocation = sett.location || 'Consultorio Virtual';
    } else {
      // No tiene psicólogo asignado, cargar directorio
      await this.loadPsychologistsByFaculty();
    }
  }

  async loadPsychologistsByFaculty() {
    if (!this.studentFaculty) {
      this.errorMsg = "No tienes una facultad asignada. Ve a configuración para asignarte una.";
      return;
    }

    const { data, error } = await this.supabase
      .from('users')
      .select('id, role_id, profiles(first_name, last_name, avatar_url, faculty)')
      .eq('role_id', 3);

    if (data) {
      this.availablePsychologists = data.map(u => {
        const p = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles;
        return {
          id: u.id,
          name: `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Especialista',
          avatar: p?.avatar_url || '',
          faculty: p?.faculty || ''
        };
      }).filter(p => p.faculty === this.studentFaculty);
      
      if (this.availablePsychologists.length === 0) {
        this.errorMsg = `No hay psicólogos disponibles en tu facultad (${this.studentFaculty}) actualmente.`;
      }
    }
  }

  async requestPsychologist(psyId: string) {
    const user = this.authService.currentUser();
    if (!user) return;
    this.loading = true;
    
    const { error } = await this.supabase
      .from('student_clinical_records')
      .update({ primary_psychologist_id: psyId })
      .eq('student_id', user.id);
      
    if (!error) {
       this.showFeedback('success', 'Psicólogo Asignado', 'Se te ha asignado al especialista correctamente. Ya puedes agendar citas.');
       this.availablePsychologists = [];
       await this.fetchAssignedPsychologist();
       if (this.psychologistId) await this.loadAvailability();
    } else {
       this.showFeedback('error', 'Error', 'No se pudo asignar el psicólogo. Asegúrate de tener tu expediente inicializado.');
       this.loading = false;
    }
  }

  async autoAssignPsychologist() {
    if (this.availablePsychologists.length > 0) {
       // Asignar al primero de la lista (simulación de menor cantidad de pacientes)
       await this.requestPsychologist(this.availablePsychologists[0].id);
    }
  }

  async loadAvailability() {
    if (!this.psychologistId) return;
    this.loading = true;
    
    try {
      const startStr = new Date().toISOString().split('T')[0];
      const endObj = new Date();
      endObj.setMonth(endObj.getMonth() + 3);
      const endStr = endObj.toISOString().split('T')[0];

      const slotsData = await this.agendaService.getStudentAvailableSlots(
        this.psychologistId,
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
      this.showFeedback('error', 'Cita Activa', 'Ya tienes una cita programada. No puedes agendar otra hasta que asistas o canceles.');
      return;
    }

    const [h, m] = slot.time.split(':').map(Number);
    const endD = new Date(2000, 1, 1, h, m + 60); // Asumiendo duraciones de 60 por fallback visual, idealmente vendría de settings
    const endStr = endD.toTimeString().substring(0, 5);

    const dialogRef = this.dialog.open(AppointmentModalComponent, {
      width: '450px',
      data: {
        psychologistName: this.psychologistName,
        psychologistEmail: this.psychologistEmail,
        psychologistAvatar: this.psychologistAvatar,
        location: this.psychologistLocation,
        dateStr: this.selectedDateStr()!,
        startTime: slot.time,
        endTime: endStr,
        status: slot.status,
        id: slot.id
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (result.action === 'book') {
          this.executeBooking(slot.time, endStr);
        } else if (result.action === 'cancel' && result.id) {
          this.executeCancellation(result.id);
        }
      }
    });
  }

  async executeBooking(slotTime: string, endStr: string) {
    if (!this.psychologistId || !this.selectedDateStr()) return;
    const dateStr = this.selectedDateStr()!;
    const user = this.authService.currentUser();
    if (!user) return;

    this.loading = true;
    const { error } = await this.supabase.from('appointments').insert({
      student_id: user.id,
      psychologist_id: this.psychologistId,
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
      this.showFeedback('success', '¡Cita Confirmada!', 'Tu reserva ha sido guardada exitosamente.');
      this.selectedDateStr.set(null);
      this.loadAvailability();
    }
  }

  async executeCancellation(appointmentId: string) {
    this.loading = true;
    const { error } = await this.supabase.from('appointments').delete().eq('id', appointmentId);
    if (error) {
      console.error(error);
      this.showFeedback('error', 'Error al Cancelar', 'Ocurrió un error: ' + error.message);
      this.loading = false;
    } else {
      this.showFeedback('success', 'Cita Cancelada', 'Tu cita ha sido cancelada correctamente y el espacio fue liberado.');
      this.selectedDateStr.set(null);
      this.loadAvailability();
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
