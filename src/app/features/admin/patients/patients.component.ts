import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule, MatIconModule, BaseChartDirective],
  templateUrl: './patients.component.html',
  styleUrls: ['./patients.component.scss']
})
export class PatientsComponent implements OnInit {

  byFaculty = [
    { faculty: 'Engineering', active: 78, dropout: 6, discharged: 3, color: '#3b82f6' },
    { faculty: 'Medicine', active: 58, dropout: 4, discharged: 2, color: '#0ea5e9' },
    { faculty: 'Law', active: 44, dropout: 6, discharged: 2, color: '#10b981' },
    { faculty: 'Arts', active: 40, dropout: 2, discharged: 1, color: '#f59e0b' },
    { faculty: 'Sciences', active: 34, dropout: 3, discharged: 1, color: '#8b5cf6' },
    { faculty: 'Education', active: 27, dropout: 1, discharged: 1, color: '#ec4899' }
  ];

  diagnosisDistribution = [
    { name: 'Anxiety', value: 31, color: '#3b82f6' },
    { name: 'Depression', value: 24, color: '#0ea5e9' },
    { name: 'Burnout', value: 14, color: '#f59e0b' },
    { name: 'PTSD', value: 10, color: '#ef4444' },
    { name: 'ADHD', value: 9, color: '#8b5cf6' },
    { name: 'Other', value: 12, color: '#94a3b8' }
  ];

  growthTrend = [
    { month: 'Jan', newPatients: 18, dropouts: 4, net: 14 },
    { month: 'Feb', newPatients: 22, dropouts: 6, net: 16 },
    { month: 'Mar', newPatients: 15, dropouts: 9, net: 6 },
    { month: 'Apr', newPatients: 26, dropouts: 3, net: 23 },
    { month: 'May', newPatients: 30, dropouts: 5, net: 25 },
    { month: 'Jun', newPatients: 24, dropouts: 7, net: 17 },
    { month: 'Jul', newPatients: 28, dropouts: 4, net: 24 }
  ];

  // Calculations for KPIs
  totalActive = 0;
  totalDropout = 0;
  totalDischarged = 0;
  total = 0;
  dropoutRate = '';
  netGrowth = 0;

  // 1. Stacked Bar Chart for Faculty Status
  public stackedBarData: ChartConfiguration<'bar'>['data'] = {
    labels: this.byFaculty.map(f => f.faculty),
    datasets: [
      { data: this.byFaculty.map(f => f.active), label: 'Active', backgroundColor: '#10b981', stack: 'a' },
      { data: this.byFaculty.map(f => f.dropout), label: 'Dropout', backgroundColor: '#ef4444', stack: 'a' },
      { data: this.byFaculty.map(f => f.discharged), label: 'Discharged', backgroundColor: '#94a3b8', stack: 'a' }
    ]
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
    labels: this.growthTrend.map(g => g.month),
    datasets: [
      { data: this.growthTrend.map(g => g.newPatients), label: 'New', borderColor: '#10b981', tension: 0.4, fill: false },
      { data: this.growthTrend.map(g => g.dropouts), label: 'Dropouts', borderColor: '#ef4444', tension: 0.4, fill: false },
      { data: this.growthTrend.map(g => g.net), label: 'Net', borderColor: '#3b82f6', borderDash: [5, 5], tension: 0.4, fill: false }
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

  // 3. Diagnosis Doughnut Chart
  public pieChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: this.diagnosisDistribution.map(d => d.name),
    datasets: [
      {
        data: this.diagnosisDistribution.map(d => d.value),
        backgroundColor: this.diagnosisDistribution.map(d => d.color),
        borderWidth: 0
      }
    ]
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

  ngOnInit(): void {
    this.totalActive = this.byFaculty.reduce((s, f) => s + f.active, 0);
    this.totalDropout = this.byFaculty.reduce((s, f) => s + f.dropout, 0);
    this.totalDischarged = this.byFaculty.reduce((s, f) => s + f.discharged, 0);
    this.total = this.totalActive + this.totalDropout + this.totalDischarged;
    this.dropoutRate = ((this.totalDropout / this.total) * 100).toFixed(1);
    this.netGrowth = this.growthTrend.reduce((s, m) => s + m.net, 0);
  }
}
