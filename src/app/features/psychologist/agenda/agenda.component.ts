import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.scss']
})
export class AgendaComponent implements OnInit {
  currentMonthName = 'Junio 2026';
  weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  daysInMonth: { number: number, isCurrentMonth: boolean, hasAppointments: boolean, isSelected: boolean }[] = [];
  
  appointments = [
    { date: 15, patient: 'Elena Marchetti', time: '09:00 AM', status: 'completed', type: 'Seguimiento' },
    { date: 17, patient: 'Sara Lindqvist', time: '11:15 AM', status: 'urgent', type: 'Intervención de Crisis' },
    { date: 17, patient: 'Amina Hassan', time: '03:00 PM', status: 'confirmed', type: 'Terapia de Grupo' },
    { date: 20, patient: 'Elena Marchetti', time: '09:00 AM', status: 'pending', type: 'Seguimiento' },
    { date: 22, patient: 'David Okafor', time: '10:00 AM', status: 'confirmed', type: 'Evaluación Inicial' }
  ];

  selectedDay: number = 17;
  selectedAppointments: any[] = [];
  showNewAppointmentModal = false;

  ngOnInit() {
    this.generateCalendar();
    this.selectDay(this.selectedDay);
  }

  generateCalendar() {
    // Offset para Junio 2026 (Empieza Lunes)
    this.daysInMonth.push({ number: 31, isCurrentMonth: false, hasAppointments: false, isSelected: false });
    
    for (let i = 1; i <= 30; i++) {
      const hasApp = this.appointments.some(a => a.date === i);
      this.daysInMonth.push({ number: i, isCurrentMonth: true, hasAppointments: hasApp, isSelected: i === this.selectedDay });
    }
    
    // Relleno final
    const remaining = 42 - this.daysInMonth.length;
    for (let i = 1; i <= remaining; i++) {
      this.daysInMonth.push({ number: i, isCurrentMonth: false, hasAppointments: false, isSelected: false });
    }
  }

  selectDay(day: number) {
    this.selectedDay = day;
    this.daysInMonth.forEach(d => {
      if (d.isCurrentMonth) d.isSelected = (d.number === day);
    });
    this.selectedAppointments = this.appointments.filter(a => a.date === day);
  }

  openNewAppointment() { this.showNewAppointmentModal = true; }
  closeModal() { this.showNewAppointmentModal = false; }
}
