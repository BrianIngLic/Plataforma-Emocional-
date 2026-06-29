import { Component, OnInit, inject, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AdminExceptionsService } from '../services/admin-exceptions.service';
import { AdminStatsService } from '../services/admin-stats.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FeedbackModalComponent } from '../../../shared/components/feedback-modal/feedback-modal.component';

interface Appointment {
  id: number;
  psychologist: string;
  patient: string;
  faculty: string;
  day: number; // 0=Mon, 1=Tue, etc.
  hour: number; // 0=08:00, 1=09:00, etc.
  type: string;
  status: 'confirmed' | 'pending' | 'urgent';
}

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatDialogModule],
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.scss']
})
export class AgendaComponent implements OnInit {

  days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  private adminStats = inject(AdminStatsService);
  private elRef = inject(ElementRef);

  appointments: Appointment[] = [];

  occupancyByFaculty: any[] = [];

  weekOffset = 0;
  selectedAppt: Appointment | null = null;
  weekDays: { name: string; shortName: string; dateNumber: number; isToday: boolean; dateObj: Date }[] = [];
  currentDateRangeString: string = '';

  // Vista Semana vs Día
  calendarViewMode: 'week' | 'day' = 'week';
  activeDayIndex: number = 0;

  // Calendario Superpuesto (Popover)
  showCalendarPopover = false;
  popoverDate = new Date();
  popoverCalendarDays: { date: Date; isCurrentMonth: boolean }[] = [];
  popoverViewMode: 'days' | 'months' | 'years' = 'days';
  monthsList = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  yearsList: number[] = [];

  totalSlots = 0;
  filledSlots = 0;
  occupancyPct = 0;
  urgentCount = 0;
  confirmedCount = 0;
  
  isImportingHolidays = false;

  private exceptionsService = inject(AdminExceptionsService);
  private dialog = inject(MatDialog);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const clickedInsideWeekSelector = this.elRef.nativeElement.querySelector('.week-selector')?.contains(event.target);
    const clickedInsidePopover = this.elRef.nativeElement.querySelector('.calendar-popover')?.contains(event.target);
    if (!clickedInsideWeekSelector && !clickedInsidePopover && this.showCalendarPopover) {
      this.showCalendarPopover = false;
    }
  }

  constructor() { }

  async loadHolidays() {
    this.isImportingHolidays = true;
    const year = new Date().getFullYear();
    
    try {
      const result = await this.exceptionsService.importHolidaysToSupabase(year);
      if (result.success) {
        this.dialog.open(FeedbackModalComponent, {
          width: '400px',
          data: { type: 'success', title: 'Festivos Importados', message: `Se han registrado ${result.count} días festivos globales para ${year} (API Nager.Date).` }
        });
      } else {
        throw new Error('Error en importación');
      }
    } catch (err) {
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { type: 'error', title: 'Error de Importación', message: 'No se pudieron cargar los festivos. Verifique su conexión y configuración de Supabase.' }
      });
    } finally {
      this.isImportingHolidays = false;
    }
  }

  async ngOnInit() {
    const curYear = new Date().getFullYear();
    for (let y = curYear - 5; y <= curYear + 5; y++) {
      this.yearsList.push(y);
    }
    this.generatePopoverCalendar();
    this.setCurrentDayAsActive();

    await this.loadAppointments();
    this.calculateMetrics();
  }

  setCurrentDayAsActive() {
    const today = new Date();
    let idx = today.getDay() - 1; // 0=Mon, 1=Tue
    if (idx < 0) idx = 0;
    if (idx > 4) idx = 4;
    this.activeDayIndex = idx;
  }

  async loadAppointments() {
    const now = new Date();
    // Cálculo preciso de Lunes a Viernes de la semana actual + weekOffset
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) + (this.weekOffset * 7);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff);
    const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6);
    
    startOfWeek.setHours(0,0,0,0);
    endOfWeek.setHours(23,59,59,999);

    // Generar días de la semana (Lunes a Viernes) para el encabezado estilo Google Calendar
    const today = new Date();
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const shortNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
    this.weekDays = [];

    for (let i = 0; i < 5; i++) {
      const d = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
      const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      this.weekDays.push({
        name: dayNames[i],
        shortName: shortNames[i],
        dateNumber: d.getDate(),
        isToday: isToday,
        dateObj: d
      });
    }

    const startStr = startOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const endFri = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 4);
    const endStr = endFri.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    this.currentDateRangeString = `${startStr} – ${endStr}`;

    const dbAppts = await this.adminStats.getAgendaAppointments(startOfWeek, endOfWeek);

    this.appointments = dbAppts.map((a: any) => {
      const dDate = new Date(a.date + 'T00:00:00'); // Evitar timezone shift
      let dayIdx = dDate.getDay() - 1; 
      if (dayIdx < 0) dayIdx = 0; 
      if (dayIdx > 4) dayIdx = 4;

      let hourIdx = parseInt(a.startTime.split(':')[0]) - 8;
      if (hourIdx < 0) hourIdx = 0;
      if (hourIdx > 9) hourIdx = 9;

      return {
        id: a.id,
        psychologist: a.psychologist,
        patient: a.patient,
        faculty: a.faculty,
        day: dayIdx,
        hour: hourIdx,
        type: a.type,
        status: a.status
      };
    });

    const facStats = await this.adminStats.getFacultiesWithStats();
    const colors = ['#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    this.occupancyByFaculty = facStats.map((f, i) => ({
      faculty: f.name,
      total: f.capacity,
      filled: f.patients,
      color: colors[i % colors.length]
    }));
  }

  calculateMetrics() {
    this.totalSlots = this.occupancyByFaculty.reduce((s, f) => s + f.total, 0);
    this.filledSlots = this.occupancyByFaculty.reduce((s, f) => s + f.filled, 0);
    this.occupancyPct = Math.round((this.filledSlots / this.totalSlots) * 100);
    this.urgentCount = this.appointments.filter(a => a.status === 'urgent').length;
    this.confirmedCount = this.appointments.filter(a => a.status === 'confirmed').length;
  }

  get saturatedFaculties() {
    return this.occupancyByFaculty.filter(f => Math.round((f.filled / f.total) * 100) >= 85);
  }

  get saturatedFacultiesNamesString() {
    return this.saturatedFaculties.map(f => f.faculty).join(', ');
  }

  getApptAt(day: number, hour: number): Appointment | undefined {
    return this.appointments.find(a => a.day === day && a.hour === hour);
  }

  selectAppt(appt: Appointment) {
    this.selectedAppt = appt;
  }

  getStatusClass(status: string): string {
    if (status === 'confirmed') return 'status-confirmed';
    if (status === 'urgent') return 'status-urgent';
    return 'status-pending';
  }

  getStatusText(status: string): string {
    if (status === 'confirmed') return 'Confirmada';
    if (status === 'urgent') return 'Urgente';
    return 'Pendiente';
  }

  getOccupancyBarColor(pct: number, defaultColor: string): string {
    if (pct >= 85) return '#ef4444'; // red
    if (pct >= 65) return '#f59e0b'; // amber
    return defaultColor;
  }

  async prevWeek() {
    this.weekOffset--;
    this.selectedAppt = null;
    await this.loadAppointments();
    this.calculateMetrics();
  }

  async nextWeek() {
    this.weekOffset++;
    this.selectedAppt = null;
    await this.loadAppointments();
    this.calculateMetrics();
  }

  async resetWeek() {
    this.weekOffset = 0;
    this.selectedAppt = null;
    this.setCurrentDayAsActive();
    await this.loadAppointments();
    this.calculateMetrics();
  }

  // --- Funcionalidad del Calendario Superpuesto (Popover) ---
  get popoverMonthYearString(): string {
    if (this.popoverViewMode === 'months') return this.popoverDate.getFullYear().toString();
    if (this.popoverViewMode === 'years') return 'Selector de Año';
    return this.popoverDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }

  toggleCalendarPopover() {
    this.showCalendarPopover = !this.showCalendarPopover;
    if (this.showCalendarPopover) {
      this.popoverViewMode = 'days';
      this.generatePopoverCalendar();
    }
  }

  generatePopoverCalendar() {
    this.popoverCalendarDays = [];
    const year = this.popoverDate.getFullYear();
    const month = this.popoverDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startDayOfWeek = firstDay.getDay() - 1; 
    if (startDayOfWeek === -1) startDayOfWeek = 6; 

    // Fechas anteriores para rellenar
    for (let i = startDayOfWeek; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      this.popoverCalendarDays.push({ date: d, isCurrentMonth: false });
    }

    // Fechas del mes actual
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      this.popoverCalendarDays.push({ date: d, isCurrentMonth: true });
    }

    // Rellenar hasta completar grilla de 42 celdas
    const remainingDays = 42 - this.popoverCalendarDays.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      this.popoverCalendarDays.push({ date: d, isCurrentMonth: false });
    }
  }

  popoverPrevMonth() {
    if (this.popoverViewMode === 'days') {
      this.popoverDate = new Date(this.popoverDate.getFullYear(), this.popoverDate.getMonth() - 1, 1);
    } else if (this.popoverViewMode === 'months') {
      this.popoverDate = new Date(this.popoverDate.getFullYear() - 1, this.popoverDate.getMonth(), 1);
    }
    this.generatePopoverCalendar();
  }

  popoverNextMonth() {
    if (this.popoverViewMode === 'days') {
      this.popoverDate = new Date(this.popoverDate.getFullYear(), this.popoverDate.getMonth() + 1, 1);
    } else if (this.popoverViewMode === 'months') {
      this.popoverDate = new Date(this.popoverDate.getFullYear() + 1, this.popoverDate.getMonth(), 1);
    }
    this.generatePopoverCalendar();
  }

  togglePopoverViewMode() {
    if (this.popoverViewMode === 'days') {
      this.popoverViewMode = 'months';
    } else if (this.popoverViewMode === 'months') {
      this.popoverViewMode = 'years';
    } else {
      this.popoverViewMode = 'days';
    }
  }

  selectPopoverMonth(index: number) {
    this.popoverDate = new Date(this.popoverDate.getFullYear(), index, 1);
    this.popoverViewMode = 'days';
    this.generatePopoverCalendar();
  }

  selectPopoverYear(year: number) {
    this.popoverDate = new Date(year, this.popoverDate.getMonth(), 1);
    this.popoverViewMode = 'months';
    this.generatePopoverCalendar();
  }

  async selectSpecificDate(date: Date) {
    this.popoverDate = date;
    this.showCalendarPopover = false;

    // Calcular la diferencia de semanas con respecto a la semana actual
    const now = new Date();
    const dayNow = now.getDay();
    const startOfCurrentWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayNow + (dayNow === 0 ? -6 : 1));
    startOfCurrentWeek.setHours(0,0,0,0);

    const targetDate = new Date(date);
    targetDate.setHours(0,0,0,0);
    const dayTarget = targetDate.getDay();
    const startOfTargetWeek = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() - dayTarget + (dayTarget === 0 ? -6 : 1));
    startOfTargetWeek.setHours(0,0,0,0);

    const diffTime = startOfTargetWeek.getTime() - startOfCurrentWeek.getTime();
    const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));
    
    this.weekOffset = diffWeeks;

    let dayIdx = targetDate.getDay() - 1;
    if (dayIdx < 0) dayIdx = 0;
    if (dayIdx > 4) dayIdx = 4;
    this.activeDayIndex = dayIdx;
    this.calendarViewMode = 'day';

    await this.loadAppointments();
    this.calculateMetrics();
  }

  // --- Selección de Vista (Semana vs Día) ---
  switchCalendarViewMode(mode: 'week' | 'day') {
    this.calendarViewMode = mode;
    if (mode === 'day') {
      // Si cambia a día, asegurar que haya un activeDayIndex válido
      if (this.weekOffset === 0) {
        this.setCurrentDayAsActive();
      }
    }
  }

  selectHeaderDay(index: number) {
    this.activeDayIndex = index;
    this.calendarViewMode = 'day';
  }

}
