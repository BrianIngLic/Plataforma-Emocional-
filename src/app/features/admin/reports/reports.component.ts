import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, MatIconModule, BaseChartDirective],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit {

  selectedTab: 'faculty' | 'psychologist' | 'period' = 'faculty';

  COLORS = ['#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  facultyReport = [
    { faculty: 'Engineering', sessions: 182, patients: 87, dropout: 6, avg: 51, color: '#3b82f6' },
    { faculty: 'Medicine', sessions: 156, patients: 64, dropout: 4, avg: 55, color: '#0ea5e9' },
    { faculty: 'Law', sessions: 120, patients: 52, dropout: 6, avg: 48, color: '#10b981' },
    { faculty: 'Arts', sessions: 105, patients: 43, dropout: 2, avg: 52, color: '#f59e0b' },
    { faculty: 'Sciences', sessions: 88, patients: 38, dropout: 3, avg: 50, color: '#8b5cf6' },
    { faculty: 'Education', sessions: 64, patients: 29, dropout: 1, avg: 49, color: '#ec4899' }
  ];

  psychReport = [
    { name: 'Dr. Rivera', sessions: 182, patients: 38, attendance: 91, efficiency: 91 },
    { name: 'Dr. Osei', sessions: 156, patients: 35, attendance: 88, efficiency: 87 },
    { name: 'Dr. Nakamura', sessions: 105, patients: 22, attendance: 94, efficiency: 94 },
    { name: 'Dr. Müller', sessions: 120, patients: 31, attendance: 79, efficiency: 77 },
    { name: 'Dr. Santos', sessions: 64, patients: 14, attendance: 86, efficiency: 85 },
    { name: 'Dr. Al-Farsi', sessions: 138, patients: 29, attendance: 90, efficiency: 89 }
  ];

  periodReport = [
    { month: 'Jan', sessions: 310, new: 18, dropouts: 4, avgScore: 6.2 },
    { month: 'Feb', sessions: 328, new: 22, dropouts: 6, avgScore: 6.4 },
    { month: 'Mar', sessions: 295, new: 15, dropouts: 9, avgScore: 5.9 },
    { month: 'Apr', sessions: 341, new: 26, dropouts: 3, avgScore: 6.7 },
    { month: 'May', sessions: 367, new: 30, dropouts: 5, avgScore: 7.0 },
    { month: 'Jun', sessions: 352, new: 24, dropouts: 7, avgScore: 6.8 },
    { month: 'Jul', sessions: 389, new: 28, dropouts: 4, avgScore: 7.2 }
  ];

  // 1. Faculty Sessions Bar Chart
  public facultyChartData: ChartConfiguration<'bar'>['data'] = {
    labels: this.facultyReport.map(f => f.faculty),
    datasets: [
      {
        data: this.facultyReport.map(f => f.sessions),
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
    labels: this.psychReport.map(p => p.name),
    datasets: [
      {
        data: this.psychReport.map(p => p.sessions),
        label: 'Sessions',
        backgroundColor: '#3b82f6',
        borderRadius: 4
      },
      {
        data: this.psychReport.map(p => p.attendance),
        label: 'Attendance Rate',
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
    labels: this.periodReport.map(p => p.month),
    datasets: [
      {
        data: this.periodReport.map(p => p.new),
        label: 'New Patients',
        backgroundColor: '#10b981',
        borderRadius: 4
      },
      {
        data: this.periodReport.map(p => p.dropouts),
        label: 'Dropouts',
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
  }

}
