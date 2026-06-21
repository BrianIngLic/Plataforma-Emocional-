import { Component, OnInit, inject } from '@angular/core';
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

  appointments: Appointment[] = [];

  occupancyByFaculty: any[] = [];

  weekOffset = 0;
  selectedAppt: Appointment | null = null;

  totalSlots = 0;
  filledSlots = 0;
  occupancyPct = 0;
  urgentCount = 0;
  confirmedCount = 0;
  
  isImportingHolidays = false;

  private exceptionsService = inject(AdminExceptionsService);
  private dialog = inject(MatDialog);

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
    await this.loadAppointments();
    this.calculateMetrics();
  }

  async loadAppointments() {
    const now = new Date();
    // Aproximación: Lunes a Viernes de la semana actual
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // ajusta cuando el día es domingo
    const startOfWeek = new Date(now.setDate(diff));
    const endOfWeek = new Date(now.setDate(diff + 6));
    
    startOfWeek.setHours(0,0,0,0);
    endOfWeek.setHours(23,59,59,999);

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

  prevWeek() {
    this.weekOffset--;
    this.selectedAppt = null;
  }

  nextWeek() {
    this.weekOffset++;
    this.selectedAppt = null;
  }

  resetWeek() {
    this.weekOffset = 0;
    this.selectedAppt = null;
  }

}
