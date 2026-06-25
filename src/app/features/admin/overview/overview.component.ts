import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { AdminStatsService, OverviewMetrics } from '../services/admin-stats.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, MatIconModule, BaseChartDirective],
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss']
})
export class OverviewComponent implements OnInit {

  private adminStats = inject(AdminStatsService);

  metrics: OverviewMetrics | null = null;
  loading = true;

  kpis = [
    { label: 'Active Patients', value: '0', sub: 'Calculando...', icon: 'people', class: 'blue' },
    { label: 'Psychologists', value: '0', sub: 'Calculando...', icon: 'assignment_ind', class: 'violet' },
    { label: 'Sessions Today', value: '0', sub: 'Calculando...', icon: 'calendar_today', class: 'emerald' },
    { label: 'Active Alerts', value: '0', sub: 'Calculando...', icon: 'warning', class: 'red' }
  ];

  patientsByFaculty: { faculty: string, patients: number, color: string }[] = [];

  occupancyByPsychologist = [
    { name: 'Cargando datos...', patients: 0, capacity: 1, pct: 0 }
  ];

  // 1. Trend Line Chart
  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    datasets: [
      { 
        data: [310, 328, 295, 341, 367, 352, 389], 
        label: 'Sessions', 
        borderColor: '#3b82f6', 
        backgroundColor: 'rgba(59, 130, 246, 0.1)', 
        tension: 0.4, 
        fill: true 
      },
      { 
        data: [18, 22, 15, 26, 30, 24, 28], 
        label: 'New Patients', 
        borderColor: '#10b981', 
        backgroundColor: 'rgba(16, 185, 129, 0.1)', 
        tension: 0.4, 
        fill: true 
      },
      { 
        data: [4, 6, 9, 3, 5, 7, 4], 
        label: 'Dropouts', 
        borderColor: '#ef4444', 
        backgroundColor: 'rgba(239, 68, 68, 0.1)', 
        tension: 0.4, 
        fill: true 
      }
    ]
  };

  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: { 
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { family: 'monospace', size: 9 } }
      },
      y: { 
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'monospace', size: 9 } }
      }
    }
  };

  // 2. Horizontal Bar Chart (Faculty Patients)
  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{ data: [], backgroundColor: [], borderRadius: 4 }]
  };

  public barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y', // Makes the chart horizontal
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'monospace', size: 9 } }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { family: 'monospace', size: 9 } }
      }
    }
  };

  constructor() { }

  async ngOnInit() {
    await this.loadStats();
  }

  async loadStats() {
    this.loading = true;
    this.metrics = await this.adminStats.getOverviewMetrics();
    
    this.kpis = [
      { label: 'Pacientes Activos', value: String(this.metrics.activePatients), sub: `↑ ${this.metrics.newPatientsThisMonth} nuevos este mes`, icon: 'people', class: 'blue' },
      { label: 'Psicólogos', value: String(this.metrics.psychologists), sub: `${this.metrics.activePsychologists} con carga activa`, icon: 'assignment_ind', class: 'violet' },
      { label: 'Sesiones Hoy', value: String(this.metrics.sessionsToday), sub: 'A través de la red', icon: 'calendar_today', class: 'emerald' },
      { label: 'Alertas Activas', value: String(this.metrics.activeAlerts), sub: 'En proceso', icon: 'warning', class: 'red' }
    ];

    const facData = await this.adminStats.getPatientsByFaculty();
    this.patientsByFaculty = facData.map(f => ({ faculty: f.label, patients: f.value, color: f.color || '#3b82f6' }));
    
    this.barChartData = {
      labels: this.patientsByFaculty.map(f => f.faculty),
      datasets: [{
        data: this.patientsByFaculty.map(f => f.patients),
        backgroundColor: this.patientsByFaculty.map(f => f.color),
        borderRadius: 4
      }]
    };

    this.loading = false;
  }

  getOccupancyColor(pct: number): string {
    if (pct >= 90) return '#ef4444'; // Overload
    if (pct >= 75) return '#f59e0b'; // Amber
    return '#10b981'; // Healthy
  }
}
