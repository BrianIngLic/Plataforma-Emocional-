import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { AdminStatsService } from '../services/admin-stats.service';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule, MatIconModule, BaseChartDirective],
  templateUrl: './patients.component.html',
  styleUrls: ['./patients.component.scss']
})
export class PatientsComponent implements OnInit {

  private adminStats = inject(AdminStatsService);

  byFaculty: any[] = [];
  diagnosisDistribution: any[] = [];
  growthTrend: any[] = [];

  // Calculations for KPIs
  totalActive = 0;
  totalDropout = 0;
  totalDischarged = 0;
  total = 0;
  dropoutRate = '';
  netGrowth = 0;

  // 1. Stacked Bar Chart for Faculty Status
  public stackedBarData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: []
  };

  public stackedBarOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { family: 'monospace', size: 9 } }
      },
      y: {
        stacked: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'monospace', size: 9 } }
      }
    }
  };

  // 2. Growth and Dropout Trend Line Chart
  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: []
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

  // 3. Diagnosis Doughnut Chart
  public pieChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: []
  };

  public pieChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: { display: false }
    }
  };

  constructor() { }

  async ngOnInit() {
    const stats = await this.adminStats.getPatientStats();
    if (stats) {
      this.byFaculty = stats.byFaculty;
      this.diagnosisDistribution = stats.diagnosisDistribution;
      this.growthTrend = stats.growthTrend;
    }

    this.totalActive = this.byFaculty.reduce((s, f) => s + f.active, 0);
    this.totalDropout = this.byFaculty.reduce((s, f) => s + f.dropout, 0);
    this.totalDischarged = this.byFaculty.reduce((s, f) => s + f.discharged, 0);
    this.total = this.totalActive + this.totalDropout + this.totalDischarged;
    this.dropoutRate = this.total > 0 ? ((this.totalDropout / this.total) * 100).toFixed(1) : '0.0';
    this.netGrowth = this.growthTrend.reduce((s, m) => s + m.net, 0);

    this.updateCharts();
  }

  updateCharts() {
    // 1. Stacked Bar Chart for Faculty Status
    this.stackedBarData = {
      labels: this.byFaculty.map(f => f.faculty),
      datasets: [
        { data: this.byFaculty.map(f => f.active), label: 'Activos', backgroundColor: '#10b981', stack: 'a' },
        { data: this.byFaculty.map(f => f.dropout), label: 'Desertores', backgroundColor: '#ef4444', stack: 'a' },
        { data: this.byFaculty.map(f => f.discharged), label: 'Dados de Alta', backgroundColor: '#94a3b8', stack: 'a' }
      ]
    };

    // 2. Growth and Dropout Trend Line Chart
    this.lineChartData = {
      labels: this.growthTrend.map(g => g.month),
      datasets: [
        { data: this.growthTrend.map(g => g.newPatients), label: 'Nuevos', borderColor: '#10b981', tension: 0.4, fill: false },
        { data: this.growthTrend.map(g => g.dropouts), label: 'Desertores', borderColor: '#ef4444', tension: 0.4, fill: false },
        { data: this.growthTrend.map(g => g.net), label: 'Neto', borderColor: '#3b82f6', borderDash: [5, 5], tension: 0.4, fill: false }
      ]
    };

    // 3. Diagnosis Doughnut Chart
    this.pieChartData = {
      labels: this.diagnosisDistribution.map(d => d.name),
      datasets: [
        {
          data: this.diagnosisDistribution.map(d => d.value),
          backgroundColor: this.diagnosisDistribution.map(d => d.color),
          borderWidth: 0
        }
      ]
    };
  }
}
