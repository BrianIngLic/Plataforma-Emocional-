import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

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
  imports: [CommonModule, MatIconModule],
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.scss']
})
export class AgendaComponent implements OnInit {

  days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  appointments: Appointment[] = [
    { id: 1, psychologist: 'Dr. Rivera', patient: 'Elena M.', faculty: 'Engineering', day: 0, hour: 1, type: 'Seguimiento', status: 'confirmed' },
    { id: 2, psychologist: 'Dr. Rivera', patient: 'Sara L.', faculty: 'Engineering', day: 0, hour: 3, type: 'Crisis', status: 'urgent' },
    { id: 3, psychologist: 'Dr. Osei', patient: 'David O.', faculty: 'Medicine', day: 0, hour: 2, type: 'Evaluación', status: 'confirmed' },
    { id: 4, psychologist: 'Dr. Osei', patient: 'Lena B.', faculty: 'Medicine', day: 1, hour: 1, type: 'Seguimiento', status: 'pending' },
    { id: 5, psychologist: 'Dr. Müller', patient: 'Tomás R.', faculty: 'Law', day: 1, hour: 5, type: 'Seguimiento', status: 'confirmed' },
    { id: 6, psychologist: 'Dr. Müller', patient: 'Carla D.', faculty: 'Law', day: 2, hour: 4, type: 'EMDR', status: 'confirmed' },
    { id: 7, psychologist: 'Dr. Nakamura', patient: 'Kenji W.', faculty: 'Sciences', day: 2, hour: 9, type: 'Teleterapia', status: 'pending' },
    { id: 8, psychologist: 'Dr. Al-Farsi', patient: 'Amina H.', faculty: 'Arts', day: 3, hour: 7, type: 'Grupal', status: 'confirmed' },
    { id: 9, psychologist: 'Dr. Santos', patient: 'Marco F.', faculty: 'Education', day: 3, hour: 2, type: 'Seguimiento', status: 'confirmed' },
    { id: 10, psychologist: 'Dr. Rivera', patient: 'Yusuf A.', faculty: 'Engineering', day: 4, hour: 1, type: 'Crisis', status: 'urgent' },
    { id: 11, psychologist: 'Dr. Osei', patient: 'Ana P.', faculty: 'Medicine', day: 4, hour: 3, type: 'Evaluación', status: 'confirmed' },
    { id: 12, psychologist: 'Dr. Müller', patient: 'Ben S.', faculty: 'Law', day: 1, hour: 8, type: 'Seguimiento', status: 'confirmed' },
    { id: 13, psychologist: 'Dr. Al-Farsi', patient: 'Mia K.', faculty: 'Arts', day: 0, hour: 6, type: 'Seguimiento', status: 'confirmed' },
    { id: 14, psychologist: 'Dr. Santos', patient: 'Leo R.', faculty: 'Education', day: 2, hour: 0, type: 'Evaluación', status: 'pending' }
  ];

  occupancyByFaculty = [
    { faculty: 'Engineering', total: 52, filled: 48, color: '#3b82f6' },
    { faculty: 'Medicine', total: 48, filled: 40, color: '#0ea5e9' },
    { faculty: 'Law', total: 40, filled: 35, color: '#10b981' },
    { faculty: 'Arts & Humanities', total: 35, filled: 27, color: '#f59e0b' },
    { faculty: 'Sciences', total: 30, filled: 22, color: '#8b5cf6' },
    { faculty: 'Education', total: 25, filled: 18, color: '#ec4899' }
  ];

  weekOffset = 0;
  selectedAppt: Appointment | null = null;

  totalSlots = 0;
  filledSlots = 0;
  occupancyPct = 0;
  urgentCount = 0;
  confirmedCount = 0;

  constructor() { }

  ngOnInit(): void {
    this.calculateMetrics();
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
