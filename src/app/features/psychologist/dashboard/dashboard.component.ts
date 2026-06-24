import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

@Component({
  selector: 'app-psychologist-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class PsychologistDashboardComponent implements OnInit {

  emergencyCases = [
    { patient: "Sara Lindqvist", risk: "HIGH", diagnosis: "MDD + SI", lastContact: "Hoy 08:30", flag: "red" },
    { patient: "Yusuf Al-Amin", risk: "HIGH", diagnosis: "Bipolar I – Manic", lastContact: "Ayer", flag: "red" },
    { patient: "Carla Dominguez", risk: "MODERATE", diagnosis: "PTSD – acute", lastContact: "Hace 3 días", flag: "amber" },
    { patient: "Lena Braun", risk: "MODERATE", diagnosis: "MDD – worsening", lastContact: "Ayer", flag: "amber" }
  ];

  agenda = [
    { time: "09:00", patient: "Elena Marchetti", type: "Seguimiento", duration: 50, status: "confirmed" },
    { time: "10:00", patient: "David Okafor", type: "Evaluación Inicial", duration: 60, status: "confirmed" },
    { time: "11:15", patient: "Sara Lindqvist", type: "Intervención Crisis", duration: 45, status: "urgent" },
    { time: "13:30", patient: "Tomás Ruiz", type: "Seguimiento", duration: 50, status: "confirmed" },
    { time: "15:00", patient: "Amina Hassan", type: "Terapia de Grupo", duration: 90, status: "confirmed" },
    { time: "17:00", patient: "Kenji Watanabe", type: "Teleterapia", duration: 50, status: "pending" }
  ];

  alerts = [
    { id: 1, level: "critical", patient: "Sara Lindqvist", message: "Ideación de autolesión detectada por Amati en el diario.", time: "08:42" },
    { id: 2, level: "warning", patient: "Marco Ferretti", message: "Faltó a 3 citas seguidas. Sin respuesta.", time: "Ayer" },
    { id: 3, level: "warning", patient: "Lena Braun", message: "Su puntuación PHQ-9 aumentó 8 puntos.", time: "Ayer" },
    { id: 4, level: "info", patient: "David Okafor", message: "Cuestionario de ansiedad pre-sesión completado.", time: "Hace 2h" }
  ];

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'],
    datasets: [
      { data: [38, 41, 35, 44, 50, 47, 53], label: 'Mejora', borderColor: '#1a56db', backgroundColor: 'rgba(26, 86, 219, 0.1)', tension: 0.4, fill: false },
      { data: [22, 19, 25, 21, 18, 23, 20], label: 'Estable', borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', tension: 0.4, fill: false },
      { data: [8, 6, 9, 5, 7, 4, 6], label: 'Deterioro', borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.4, fill: false }
    ]
  };
  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } } }
  };

  public pieChartLabels = [ "Ansiedad", "Depresión", "PTSD", "Bipolar", "Otros" ];
  public pieChartValues = [ 34, 28, 14, 10, 14 ];
  public pieChartColors = [ '#1a56db', '#0ea5e9', '#10b981', '#f59e0b', '#94a3b8' ];

  public pieChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: this.pieChartLabels,
    datasets: [ {
      data: this.pieChartValues,
      backgroundColor: this.pieChartColors,
      borderWidth: 0,
      hoverOffset: 4
    } ]
  };
  public pieChartOptions: ChartOptions<'doughnut'> = {
    responsive: true, maintainAspectRatio: false, cutout: '70%',
    plugins: { legend: { display: false } }
  };

  ngOnInit() {}
}
