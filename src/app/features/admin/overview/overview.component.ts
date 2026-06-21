import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, MatIconModule, BaseChartDirective],
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss']
})
export class OverviewComponent implements OnInit {

  kpis = [
    { label: 'Active Patients', value: '313', sub: '↑ 12 new this month', icon: 'people', class: 'blue' },
    { label: 'Psychologists', value: '6', sub: '5 with active caseload', icon: 'assignment_ind', class: 'violet' },
    { label: 'Sessions Today', value: '47', sub: 'Across 6 faculties', icon: 'calendar_today', class: 'emerald' },
    { label: 'Active Alerts', value: '5', sub: '2 critical, 3 attention', icon: 'warning', class: 'red' }
  ];

  patientsByFaculty = [
    { faculty: 'Engineering', patients: 87, color: '#3b82f6' },
    { faculty: 'Medicine', patients: 64, color: '#0ea5e9' },
    { faculty: 'Law', patients: 52, color: '#10b981' },
    { faculty: 'Arts', patients: 43, color: '#f59e0b' },
    { faculty: 'Sciences', patients: 38, color: '#8b5cf6' },
    { faculty: 'Education', patients: 29, color: '#ec4899' }
  ];

  occupancyByPsychologist = [
    { name: 'Dr. Rivera', patients: 38, capacity: 40, pct: 95 },
    { name: 'Dr. Osei', patients: 35, capacity: 40, pct: 88 },
    { name: 'Dr. Nakamura', patients: 22, capacity: 35, pct: 63 },
    { name: 'Dr. Müller', patients: 31, capacity: 35, pct: 89 },
    { name: 'Dr. Santos', patients: 14, capacity: 30, pct: 47 },
    { name: 'Dr. Al-Farsi', patients: 29, capacity: 35, pct: 83 }
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
    labels: this.patientsByFaculty.map(f => f.faculty),
    datasets: [
      {
        data: this.patientsByFaculty.map(f => f.patients),
        backgroundColor: this.patientsByFaculty.map(f => f.color),
        borderRadius: 4
      }
    ]
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

  ngOnInit(): void {
  }

  getOccupancyColor(pct: number): string {
    if (pct >= 90) return '#ef4444'; // Overload
    if (pct >= 75) return '#f59e0b'; // Amber
    return '#10b981'; // Healthy
  }
}
