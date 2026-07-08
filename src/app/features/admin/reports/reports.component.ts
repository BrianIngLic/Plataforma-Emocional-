import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { AdminStatsService } from '../services/admin-stats.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, MatIconModule, BaseChartDirective],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit {

  private adminStatsService = inject(AdminStatsService);

  selectedTab: 'faculty' | 'psychologist' | 'period' = 'faculty';
  isLoading = true;
  dateRangeStr = '';

  COLORS = ['#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  facultyReport: any[] = [];
  psychReport: any[] = [];
  periodReport: any[] = [];

  // 1. Faculty Sessions Bar Chart
  public facultyChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: this.COLORS,
        borderRadius: 4
      }
    ]
  };

  public facultyChartOptions: ChartOptions<'bar'> = {
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

  // 2. Psychologist Sessions & Attendance Bar Chart
  public psychChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Sesiones',
        backgroundColor: '#3b82f6',
        borderRadius: 4
      },
      {
        data: [],
        label: 'Tasa de Asistencia',
        backgroundColor: '#10b981',
        borderRadius: 4
      }
    ]
  };

  public psychChartOptions: ChartOptions<'bar'> = {
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

  // 3. Period Sessions Line Chart
  public periodLineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  public periodLineChartOptions: ChartOptions<'line'> = {
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

  // 4. Period New vs Dropouts Bar Chart
  public periodBarChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Nuevos Pacientes',
        backgroundColor: '#10b981',
        borderRadius: 4
      },
      {
        data: [],
        label: 'Deserciones',
        backgroundColor: '#ef4444',
        borderRadius: 4
      }
    ]
  };

  public periodBarChartOptions: ChartOptions<'bar'> = {
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

  constructor() { }

  ngOnInit(): void {
    this.loadReports();
  }

  async loadReports(): Promise<void> {
    this.isLoading = true;
    try {
      const data = await this.adminStatsService.getReportsData();
      this.facultyReport = data.facultyReport;
      this.psychReport = data.psychReport;
      this.periodReport = data.periodReport;

      // Calcular rango de fechas dinámico (ponytail: simplificado)
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      const spanishMonths = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      this.dateRangeStr = `${spanishMonths[start.getMonth()]} ${start.getFullYear()} – ${spanishMonths[today.getMonth()]} ${today.getFullYear()}`;

      this.updateCharts();
    } catch (error) {
      console.error('Error cargando reportes:', error);
    } finally {
      this.isLoading = false;
    }
  }

  updateCharts(): void {
    // 1. Faculty Sessions Bar Chart
    this.facultyChartData = {
      labels: this.facultyReport.map(f => f.faculty),
      datasets: [
        {
          data: this.facultyReport.map(f => f.sessions),
          backgroundColor: this.COLORS,
          borderRadius: 4
        }
      ]
    };

    // 2. Psychologist Sessions & Attendance Bar Chart
    this.psychChartData = {
      labels: this.psychReport.map(p => p.name),
      datasets: [
        {
          data: this.psychReport.map(p => p.sessions),
          label: 'Sesiones',
          backgroundColor: '#3b82f6',
          borderRadius: 4
        },
        {
          data: this.psychReport.map(p => p.attendance),
          label: 'Tasa de Asistencia',
          backgroundColor: '#10b981',
          borderRadius: 4
        }
      ]
    };

    // 3. Period Sessions Line Chart
    this.periodLineChartData = {
      labels: this.periodReport.map(p => p.month),
      datasets: [
        {
          data: this.periodReport.map(p => p.sessions),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          tension: 0.4,
          fill: true
        }
      ]
    };

    // 4. Period New vs Dropouts Bar Chart
    this.periodBarChartData = {
      labels: this.periodReport.map(p => p.month),
      datasets: [
        {
          data: this.periodReport.map(p => p.new),
          label: 'Nuevos Pacientes',
          backgroundColor: '#10b981',
          borderRadius: 4
        },
        {
          data: this.periodReport.map(p => p.dropouts),
          label: 'Deserciones',
          backgroundColor: '#ef4444',
          borderRadius: 4
        }
      ]
    };
  }
}
