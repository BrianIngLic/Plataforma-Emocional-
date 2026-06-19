import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { AgendaService } from '../../../core/services/agenda.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  hasAppointments: boolean;
  isBlocked: boolean;
}

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.scss']
})
export class AgendaComponent implements OnInit {
  authService = inject(AuthService);
  agendaService = inject(AgendaService);
  supabase = inject(SupabaseService).supabase;

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

  get monthYearString(): string {
    if (this.viewMode === 'months') return this.currentDate.getFullYear().toString();
    return this.currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }

  get currentUserId() { return this.authService.currentUser()?.id; }

  async ngOnInit() {
    this.selectedDate = new Date();
    await this.generateCalendar();
    await this.loadDayDetails(this.selectedDate);
    this.isLoading = false;
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
    // Buscar en appointments uniendolo con perfiles para buscar por texto
    // En Supabase, para buscar por perfiles anidados necesitamos algo especial o hacer dos consultas.
    // Como V1, busquemos las citas y filtremos en memoria si no podemos hacer inner join con ilike.
    
    const { data: appts } = await this.supabase
      .from('appointments')
      .select('*, student:users(profiles(first_name, last_name, avatar_url))')
      .eq('psychologist_id', this.currentUserId)
      .order('scheduled_date', { ascending: false });

    if (appts) {
      const q = this.searchQuery.toLowerCase();
      this.searchResults = appts.filter((a: any) => {
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
    
    const dateString = date.toISOString().split('T')[0];
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
      .from('psychologist_exceptions')
      .select('*')
      .eq('exception_date', dateString)
      .or(`psychologist_id.eq.${this.currentUserId},psychologist_id.is.null`);
      
    this.dayExceptions = excs || [];

    // 3. Obtener Citas de este día
    const startOfDay = new Date(date);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23,59,59,999);

    const { data: appts } = await this.supabase
      .from('appointments')
      .select('*, student:users(profiles(first_name, last_name, avatar_url))')
      .eq('psychologist_id', this.currentUserId)
      .gte('scheduled_date', startOfDay.toISOString())
      .lte('scheduled_date', endOfDay.toISOString())
      .order('scheduled_date', { ascending: true });

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
      const time = new Date(a.scheduled_date).toTimeString().substring(0,5);
      this.timelineItems.push({
        time: time,
        type: 'appointment',
        title: `Cita: ${a.student?.profiles?.first_name} ${a.student?.profiles?.last_name}`,
        desc: `Prioridad: ${a.priority_level}`,
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
}
