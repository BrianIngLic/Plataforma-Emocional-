import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { FacultyService, Faculty } from '../../../../core/services/faculty.service';
import { AdminStatsService } from '../../services/admin-stats.service';
import { FeedbackModalComponent } from '../../../../shared/components/feedback-modal/feedback-modal.component';

interface DetailedStats {
  patients: number;
  capacity: number;
  psychologists: number;
  demand: string;
  risk: string;
  avgSessionsWeek: number;
  dropoutRate: number;
  newThisMonth: number;
  topDiagnosis: string;
}

@Component({
  selector: 'app-faculty-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatIconModule, MatDialogModule, BaseChartDirective],
  templateUrl: './faculty-detail.component.html',
  styleUrls: ['./faculty-detail.component.scss']
})
export class FacultyDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private facultyService = inject(FacultyService);
  private adminStatsService = inject(AdminStatsService);
  private dialog = inject(MatDialog);

  facultyId!: string;
  faculty: Faculty | null = null;
  stats: DetailedStats | null = null;
  loading = true;

  // Specialists state
  assignedSpecialists: any[] = [];
  availableSpecialists: any[] = [];
  showAssignDrawer = false;
  isSaving = false;

  // Edit details state
  isEditing = false;
  editName = '';
  editVirtualTourUrl = '';

  // Radar Chart Configuration
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
          font: { family: 'monospace', size: 10 }
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

  ngOnInit(): void {
    this.facultyId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.facultyId) {
      this.router.navigate(['/admin/faculties']);
      return;
    }
    this.loadData();
  }

  ngOnDestroy(): void {
    // Asegurar limpieza de scroll por si acaso
    document.body.classList.remove('modal-open');
  }

  async loadData() {
    this.loading = true;
    try {
      // 1. Cargar facultad por ID
      this.faculty = await this.facultyService.getFacultyById(this.facultyId);
      if (!this.faculty) {
        this.router.navigate(['/admin/faculties']);
        return;
      }

      this.editName = this.faculty.name;
      // @ts-ignore
      this.editVirtualTourUrl = this.faculty.virtual_tour_url || '';

      // 2. Cargar estadísticas generales de la facultad
      const allFacStats = await this.adminStatsService.getFacultiesWithStats();
      const facStats = allFacStats.find(f => String(f.id) === String(this.facultyId));
      if (facStats) {
        this.stats = {
          patients: facStats.patients,
          capacity: facStats.capacity,
          psychologists: facStats.psychologists,
          demand: facStats.demand,
          risk: facStats.risk,
          avgSessionsWeek: facStats.avgSessionsWeek,
          dropoutRate: facStats.dropoutRate,
          newThisMonth: facStats.newThisMonth,
          topDiagnosis: facStats.topDiagnosis
        };

        // Actualizar gráfico radar
        const pct = this.stats.capacity > 0 ? Math.round((this.stats.patients / this.stats.capacity) * 100) : 0;
        const demandVal = { Critical: 100, High: 75, Moderate: 50, Low: 25 }[this.stats.demand] || 25;
        const riskVal = { High: 100, Moderate: 60, Low: 25 }[this.stats.risk] || 25;
        const dropoutVal = Math.min(this.stats.dropoutRate * 7, 100);
        const growthVal = Math.min(this.stats.newThisMonth * 10, 100);

        this.radarChartData.datasets[0].data = [pct, demandVal, riskVal, dropoutVal, growthVal];
      }

      // 3. Cargar todos los especialistas para mapear
      const allSpecs = await this.adminStatsService.getPsychologistsWithStats();
      this.assignedSpecialists = allSpecs.filter(s => s.faculty === this.faculty?.name);
      this.availableSpecialists = allSpecs.filter(s => s.faculty !== this.faculty?.name);

    } catch (err) {
      console.error('Error loading faculty details:', err);
    } finally {
      this.loading = false;
    }
  }

  get occupancyPct(): number {
    if (!this.stats || this.stats.capacity === 0) return 0;
    return Math.round((this.stats.patients / this.stats.capacity) * 100);
  }

  getOccupancyColor(pct: number): string {
    if (pct >= 90) return 'text-red-500';
    if (pct >= 70) return 'text-amber-500';
    return 'text-emerald-500';
  }

  getOccupancyBarColor(pct: number): string {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-amber-400';
    return 'bg-emerald-400';
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

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing && this.faculty) {
      this.editName = this.faculty.name;
      // @ts-ignore
      this.editVirtualTourUrl = this.faculty.virtual_tour_url || '';
    }
  }

  async saveFacultyDetails() {
    if (!this.editName.trim()) return;

    this.isSaving = true;
    const { data, error } = await this.facultyService.updateFaculty(
      this.facultyId, 
      this.editName.trim(), 
      this.editVirtualTourUrl.trim() || undefined
    );
    this.isSaving = false;

    if (!error) {
      this.isEditing = false;
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { type: 'success', title: 'Datos Actualizados', message: 'Los detalles de la facultad se han guardado con éxito.' }
      });
      this.loadData();
    } else {
      console.error('Error updating faculty:', error);
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { type: 'error', title: 'Error', message: 'No se pudieron actualizar los datos.' }
      });
    }
  }

  async assignSpecialist(professionalId: string) {
    this.loading = true;
    const facName = this.faculty?.name || '';
    // Cerrar el drawer y liberar el scroll lock de inmediato
    this.closeAssignDrawer();
    
    const { error } = await this.facultyService.assignSpecialist(professionalId, this.facultyId, facName);
    
    if (!error) {
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { type: 'success', title: 'Especialista Asignado', message: 'El profesional se ha incorporado exitosamente a esta facultad.' }
      });
      await this.loadData();
    } else {
      console.error('Error assigning specialist:', error);
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { 
          type: 'error', 
          title: 'Error de Asignación', 
          message: error?.message || 'No se pudo asignar al especialista por políticas de seguridad.' 
        }
      });
      this.loading = false;
    }
  }

  async removeSpecialist(professionalId: string) {
    this.loading = true;
    const { error } = await this.facultyService.removeSpecialist(professionalId);

    if (!error) {
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { type: 'success', title: 'Especialista Retirado', message: 'El profesional ha sido desvinculado de esta facultad.' }
      });
      await this.loadData();
    } else {
      console.error('Error removing specialist:', error);
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { 
          type: 'error', 
          title: 'Error al Retirar', 
          message: error?.message || 'No se pudo retirar al especialista por políticas de seguridad.' 
        }
      });
      this.loading = false;
    }
  }

  openAssignDrawer() {
    this.showAssignDrawer = true;
    document.body.classList.add('modal-open');
  }

  closeAssignDrawer() {
    this.showAssignDrawer = false;
    document.body.classList.remove('modal-open');
  }
}
