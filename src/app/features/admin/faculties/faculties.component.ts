import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { FacultyService, Faculty as DBFaculty, Campus } from '../../../core/services/faculty.service';
import { AdminStatsService } from '../services/admin-stats.service';
import { FeedbackModalComponent } from '../../../shared/components/feedback-modal/feedback-modal.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

interface AdminFaculty {
  id: string;
  name: string;
  campus_name: string;
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
  imports: [CommonModule, MatIconModule, FormsModule, BaseChartDirective, MatDialogModule],
  templateUrl: './faculties.component.html',
  styleUrls: ['./faculties.component.scss']
})
export class FacultiesComponent implements OnInit, OnDestroy {

  faculties: AdminFaculty[] = [];
  loading = true;
  campuses: Campus[] = [];

  sortBy: string = 'demand';
  compareIds: string[] = [];
  showCompareModal = false;
  
  // Add Faculty Form State
  showAddModal = false;
  newFacultyName = '';
  newFacultyCampusId: number | '' = '';
  newFacultyVirtualTourUrl = '';
  isSubmitting = false;

  // Filter states
  filterSearch = '';
  filterCampusId: number | '' = '';
  filterDemand = '';

  // Radar Chart Configuration for detail modal
  public radarChartData: ChartConfiguration<'radar'>['data'] = {
    labels: ['Ocupación %', 'Demanda %', 'Riesgo %', 'Deserción %', 'Crecimiento %'],
    datasets: [
      {
        data: [0, 0, 0, 0, 0],
        label: 'Valor de Métrica',
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

  // Agregamos la inyección
  private adminStats = inject(AdminStatsService);
  private router = inject(Router);

  constructor(
    private facultyService: FacultyService,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    document.body.classList.remove('modal-open');
  }

  toggleScrollLock() {
    const isOpen = this.showAddModal || this.showCompareModal;
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }

  async loadData() {
    this.loading = true;
    this.campuses = await this.facultyService.getCampuses();
    await this.loadFaculties();
  }

  async loadFaculties() {
    this.loading = true;
    this.faculties = await this.adminStats.getFacultiesWithStats();
    this.loading = false;
  }

  get filteredFaculties() {
    return this.faculties.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(this.filterSearch.toLowerCase());
      
      const campusObj = this.campuses.find(c => c.name === f.campus_name);
      const matchesCampus = this.filterCampusId === '' || (campusObj && campusObj.id === Number(this.filterCampusId));
      
      const matchesDemand = this.filterDemand === '' || f.demand === this.filterDemand;
      
      return matchesSearch && matchesCampus && matchesDemand;
    });
  }

  get sortedFaculties() {
    return [...this.filteredFaculties].sort((a, b) => {
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

  getPct(f: AdminFaculty): number {
    return f.capacity > 0 ? Math.round((f.patients / f.capacity) * 100) : 0;
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

  translateDemand(demand: string): string {
    const map = {
      Critical: 'Crítica',
      High: 'Alta',
      Moderate: 'Moderada',
      Low: 'Baja'
    };
    return map[demand as keyof typeof map] || demand;
  }

  translateRisk(risk: string): string {
    const map = {
      High: 'Alto',
      Moderate: 'Moderado',
      Low: 'Bajo'
    };
    return map[risk as keyof typeof map] || risk;
  }

  getCampusIcon(campusName: string): string {
    if (!campusName) return 'school';
    const name = campusName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (name.includes('cu2')) return 'forest';
    if (name.includes('cu') || name.includes('ciudad universitaria')) return 'account_balance';
    if (name.includes('salud') || name.includes('medicina')) return 'local_hospital';
    if (name.includes('complejo') || name.includes('ccu') || name.includes('cultural')) return 'theater_comedy';
    if (name.includes('centro')) return 'location_city';
    return 'domain';
  }

  getCampusClass(campusName: string): string {
    if (!campusName) return '';
    const name = campusName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (name.includes('cu2')) return 'campus-cu2';
    if (name.includes('cu') || name.includes('ciudad universitaria')) return 'campus-cu';
    if (name.includes('salud') || name.includes('medicina')) return 'campus-salud';
    if (name.includes('complejo') || name.includes('ccu') || name.includes('cultural')) return 'campus-ccu';
    if (name.includes('centro')) return 'campus-centro';
    return 'campus-generic';
  }

  viewDetail(f: AdminFaculty) {
    this.router.navigate(['/admin/faculties', f.id]);
  }

  openCompare() {
    if (this.compareIds.length >= 2) {
      this.showCompareModal = true;
      this.toggleScrollLock();
    }
  }

  closeCompare() {
    this.showCompareModal = false;
    this.toggleScrollLock();
  }

  openAddModal() {
    this.showAddModal = true;
    this.newFacultyName = '';
    this.newFacultyCampusId = '';
    this.newFacultyVirtualTourUrl = '';
    this.toggleScrollLock();
  }

  closeAddModal() {
    this.showAddModal = false;
    this.toggleScrollLock();
  }

  async addFaculty() {
    if (!this.newFacultyName.trim() || this.newFacultyCampusId === '') return;

    this.isSubmitting = true;
    const { data, error } = await this.facultyService.createFaculty(
      this.newFacultyName, 
      Number(this.newFacultyCampusId),
      this.newFacultyVirtualTourUrl.trim() || undefined
    );
    this.isSubmitting = false;

    if (!error) {
      this.closeAddModal();
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { type: 'success', title: 'Facultad Creada', message: 'La facultad se ha registrado exitosamente en la base de datos.' }
      });
      this.loadFaculties(); // Recargar la lista
    } else {
      console.error('Error creating faculty:', error);
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { type: 'error', title: 'Error', message: 'No se pudo crear la facultad. Verifica la consola.' }
      });
    }
  }
}
