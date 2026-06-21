import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

interface Faculty {
  id: string;
  name: string;
  patients: number;
  capacity: number;
  psychologists: number;
  demand: 'Critical' | 'High' | 'Moderate' | 'Low';
  risk: 'High' | 'Moderate' | 'Low';
  avgSessionsWeek: number;
  dropoutRate: number;
  newThisMonth: number;
  topDiagnosis: string;
}

@Component({
  selector: 'app-faculties',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule, BaseChartDirective],
  templateUrl: './faculties.component.html',
  styleUrls: ['./faculties.component.scss']
})
export class FacultiesComponent implements OnInit {

  faculties: Faculty[] = [
    { id: 'eng', name: 'Engineering', patients: 87, capacity: 90, psychologists: 2, demand: 'Critical', risk: 'High', avgSessionsWeek: 28, dropoutRate: 8, newThisMonth: 7, topDiagnosis: 'Anxiety / Academic stress' },
    { id: 'med', name: 'Medicine', patients: 64, capacity: 80, psychologists: 2, demand: 'High', risk: 'Moderate', avgSessionsWeek: 21, dropoutRate: 5, newThisMonth: 5, topDiagnosis: 'Burnout / Depression' },
    { id: 'law', name: 'Law', patients: 52, capacity: 60, psychologists: 1, demand: 'High', risk: 'High', avgSessionsWeek: 18, dropoutRate: 11, newThisMonth: 4, topDiagnosis: 'Anxiety / Perfectionism' },
    { id: 'arts', name: 'Arts & Humanities', patients: 43, capacity: 70, psychologists: 1, demand: 'Moderate', risk: 'Low', avgSessionsWeek: 15, dropoutRate: 4, newThisMonth: 3, topDiagnosis: 'Depression / Identity' },
    { id: 'sci', name: 'Sciences', patients: 38, capacity: 60, psychologists: 1, demand: 'Moderate', risk: 'Moderate', avgSessionsWeek: 13, dropoutRate: 6, newThisMonth: 2, topDiagnosis: 'ADHD / Anxiety' },
    { id: 'edu', name: 'Education', patients: 29, capacity: 50, psychologists: 1, demand: 'Low', risk: 'Low', avgSessionsWeek: 10, dropoutRate: 3, newThisMonth: 1, topDiagnosis: 'Stress / Vocational' }
  ];

  sortBy: 'demand' | 'patients' | 'name' = 'demand';
  compareIds: string[] = [];
  showCompareModal = false;
  selectedFacultyForDetail: Faculty | null = null;

  // Radar Chart Configuration for detail modal
  public radarChartData: ChartConfiguration<'radar'>['data'] = {
    labels: ['Occupancy %', 'Demand %', 'Risk %', 'Dropout %', 'Growth %'],
    datasets: [
      {
        data: [0, 0, 0, 0, 0],
        label: 'Metric Value',
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderWidth: 2,
        pointBackgroundColor: '#3b82f6'
      }
    ]
  };

  public radarChartOptions: ChartOptions<'radar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      r: {
        grid: { color: 'rgba(255, 255, 255, 0.08)' },
        angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
        pointLabels: {
          color: '#94a3b8',
          font: { family: 'monospace', size: 9 }
        },
        ticks: {
          display: false,
          maxTicksLimit: 5
        },
        suggestedMin: 0,
        suggestedMax: 100
      }
    }
  };

  constructor() { }

  ngOnInit(): void {
  }

  get sortedFaculties() {
    return [...this.faculties].sort((a, b) => {
      if (this.sortBy === 'patients') {
        return b.patients - a.patients;
      }
      if (this.sortBy === 'demand') {
        const order = { Critical: 0, High: 1, Moderate: 2, Low: 3 };
        return order[a.demand] - order[b.demand];
      }
      return a.name.localeCompare(b.name);
    });
  }

  get hasCriticalFaculties() {
    return this.faculties.some(f => f.demand === 'Critical');
  }

  get criticalFacultiesListString() {
    return this.faculties
      .filter(f => f.demand === 'Critical')
      .map(f => f.name)
      .join(', ');
  }

  get occupancyWarningCount() {
    return this.faculties.filter(f => f.demand === 'Critical').length;
  }

  getComparedFaculties() {
    return this.faculties.filter(f => this.compareIds.includes(f.id));
  }

  toggleCompare(id: string) {
    const index = this.compareIds.indexOf(id);
    if (index > -1) {
      this.compareIds.splice(index, 1);
    } else if (this.compareIds.length < 4) {
      this.compareIds.push(id);
    }
  }

  isCompared(id: string): boolean {
    return this.compareIds.includes(id);
  }

  getPct(f: Faculty): number {
    return Math.round((f.patients / f.capacity) * 100);
  }

  getOccupancyColor(pct: number): string {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-amber-400';
    return 'bg-emerald-400';
  }

  getOccupancyColorText(pct: number): string {
    if (pct >= 90) return '#ef4444';
    if (pct >= 70) return '#f59e0b';
    return '#10b981';
  }

  getDemandClass(demand: string): string {
    const map = {
      Critical: 'demand-critical',
      High: 'demand-high',
      Moderate: 'demand-moderate',
      Low: 'demand-low'
    };
    return map[demand as keyof typeof map] || '';
  }

  getRiskClass(risk: string): string {
    const map = {
      High: 'risk-high',
      Moderate: 'risk-moderate',
      Low: 'risk-low'
    };
    return map[risk as keyof typeof map] || '';
  }

  viewDetail(f: Faculty) {
    this.selectedFacultyForDetail = f;
    const pct = this.getPct(f);
    const demandVal = { Critical: 100, High: 75, Moderate: 50, Low: 25 }[f.demand];
    const riskVal = { High: 100, Moderate: 60, Low: 25 }[f.risk];
    const dropoutVal = Math.min(f.dropoutRate * 7, 100);
    const growthVal = Math.min(f.newThisMonth * 10, 100);

    this.radarChartData.datasets[0].data = [pct, demandVal, riskVal, dropoutVal, growthVal];
  }

  closeDetail() {
    this.selectedFacultyForDetail = null;
  }

  openCompare() {
    if (this.compareIds.length >= 2) {
      this.showCompareModal = true;
    }
  }

  closeCompare() {
    this.showCompareModal = false;
  }
}
