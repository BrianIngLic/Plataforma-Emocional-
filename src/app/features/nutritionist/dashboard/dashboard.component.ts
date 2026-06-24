import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

@Component({
  selector: 'app-nutritionist-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class NutritionistDashboardComponent implements OnInit {

  // Pacientes en riesgo nutricional (p.ej., TCA alto, alergias graves, desnutrición)
  criticalCases = [
    { patient: "Ana Lucía Gómez", risk: "HIGH", diagnosis: "Riesgo Alto TCA (EAT-26: 34)", lastContact: "Hoy 09:15", flag: "red" },
    { patient: "Juan Pablo Pérez", risk: "HIGH", diagnosis: "Alergia Severa a Celíacos + Pérdida Peso", lastContact: "Ayer", flag: "red" },
    { patient: "Mariana Rodríguez", risk: "MODERATE", diagnosis: "Diabetes Tipo 1 - Descontrol Glucémico", lastContact: "Hace 2 días", flag: "amber" },
    { patient: "Carlos Alberto Sánchez", risk: "MODERATE", diagnosis: "Vegano - Sospecha de Déficit B12", lastContact: "Hace 4 días", flag: "amber" }
  ];

  // Agenda de hoy adaptada a Nutrición
  agenda = [
    { time: "08:30", patient: "Sofía Martínez", type: "Evaluación Inicial", duration: 45, status: "confirmed" },
    { time: "09:30", patient: "Eduardo Mendoza", type: "Entrega de Menú & Bioimpedancia", duration: 30, status: "confirmed" },
    { time: "10:30", patient: "Ana Lucía Gómez", type: "Sesión Interdisciplinaria", duration: 45, status: "urgent" },
    { time: "12:00", patient: "Daniela Rivas", type: "Control / Ajuste Macronutrientes", duration: 30, status: "confirmed" },
    { time: "15:30", patient: "Roberto Castillo", type: "Nutrición Deportiva (Pre-competición)", duration: 45, status: "pending" },
    { time: "16:30", patient: "Gabriela Torres", type: "Control Mensual", duration: 30, status: "confirmed" }
  ];

  // Alertas de diarios o cuestionarios
  alerts = [
    { id: 1, level: "critical", patient: "Ana Lucía Gómez", message: "EAT-26 finalizado con 34 puntos (Riesgo Alto de TCA).", time: "Hace 1h" },
    { id: 2, level: "warning", patient: "Mateo Silva", message: "Registró déficit calórico extremo en recordatorio de 24h (< 1000 kcal).", time: "Ayer" },
    { id: 3, level: "warning", patient: "Sofía Martínez", message: "Reportó malestar estomacal agudo en su diario de alimentación.", time: "Ayer" },
    { id: 4, level: "info", patient: "Eduardo Mendoza", message: "Completó su registro general de salud previo a consulta.", time: "Hace 3h" }
  ];

  // Gráfica de línea: Evolución del apego al plan alimentario semanal en el último mes
  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
    datasets: [
      { data: [65, 70, 72, 78], label: 'Apego Alto', borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 207, 0.1)', tension: 0.4, fill: false },
      { data: [25, 22, 20, 15], label: 'Apego Medio', borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', tension: 0.4, fill: false },
      { data: [10, 8, 8, 7], label: 'Apego Bajo', borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.4, fill: false }
    ]
  };

  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { 
      x: { grid: { display: false } }, 
      y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } } 
    }
  };

  // Gráfica de dona: Objetivos Nutricionales
  public pieChartLabels = [ "Pérdida de Grasa", "Ganancia Muscular", "Manejo de Diabetes", "Rendimiento Deportivo", "Intolerancias / Otros" ];
  public pieChartValues = [ 42, 28, 12, 10, 8 ];
  public pieChartColors = [ '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#94a3b8' ];

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
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: { legend: { display: false } }
  };

  ngOnInit() {}
}
