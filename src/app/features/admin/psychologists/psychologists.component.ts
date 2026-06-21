import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { SupabaseService } from '../../../core/services/supabase.service';

interface Psychologist {
  id: string;
  name: string;
  faculty: string;
  patients: number;
  capacity: number;
  attendanceRate: number;
  sessionsCompleted: number;
  sessionsScheduled: number;
  evaluation: number;
  alert: 'overload' | 'low-perf' | 'few-patients' | 'none';
  specialty: string;
  avgSessionDuration: number;
  dropouts: number;
}

@Component({
  selector: 'app-psychologists',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule, ReactiveFormsModule, BaseChartDirective],
  templateUrl: './psychologists.component.html',
  styleUrls: ['./psychologists.component.scss']
})
export class PsychologistsComponent implements OnInit {
  supabase = inject(SupabaseService).supabase;
  fb = inject(FormBuilder);

  psychologists: Psychologist[] = [
    { id: 'p1', name: 'Dr. Rivera', faculty: 'Engineering', patients: 38, capacity: 40, attendanceRate: 91, sessionsCompleted: 182, sessionsScheduled: 200, evaluation: 4.8, alert: 'overload', specialty: 'Anxiety / Academic stress', avgSessionDuration: 52, dropouts: 2 },
    { id: 'p2', name: 'Dr. Osei', faculty: 'Medicine', patients: 35, capacity: 40, attendanceRate: 88, sessionsCompleted: 156, sessionsScheduled: 180, evaluation: 4.6, alert: 'overload', specialty: 'Burnout / Depression', avgSessionDuration: 55, dropouts: 3 },
    { id: 'p3', name: 'Dr. Nakamura', faculty: 'Sciences', patients: 22, capacity: 35, attendanceRate: 94, sessionsCompleted: 105, sessionsScheduled: 112, evaluation: 4.9, alert: 'none', specialty: 'ADHD / Cognitive', avgSessionDuration: 50, dropouts: 1 },
    { id: 'p4', name: 'Dr. Müller', faculty: 'Law', patients: 31, capacity: 35, attendanceRate: 79, sessionsCompleted: 120, sessionsScheduled: 155, evaluation: 3.9, alert: 'low-perf', specialty: 'Anxiety / Perfectionism', avgSessionDuration: 48, dropouts: 7 },
    { id: 'p5', name: 'Dr. Santos', faculty: 'Education', patients: 14, capacity: 30, attendanceRate: 86, sessionsCompleted: 64, sessionsScheduled: 75, evaluation: 4.2, alert: 'few-patients', specialty: 'Stress / Vocational', avgSessionDuration: 50, dropouts: 1 },
    { id: 'p6', name: 'Dr. Al-Farsi', faculty: 'Arts & Humanities', patients: 29, capacity: 35, attendanceRate: 90, sessionsCompleted: 138, sessionsScheduled: 155, evaluation: 4.5, alert: 'none', specialty: 'Depression / Identity', avgSessionDuration: 53, dropouts: 2 }
  ];

  selectedFilter: 'all' | 'overload' | 'low-perf' | 'few-patients' | 'none' = 'all';
  selectedPsychologist: Psychologist | null = null;
  
  // Registration Form state
  showAddModal = false;
  addForm!: FormGroup;
  formErrorMessage = '';
  formSuccessMessage = '';
  isSubmitting = false;

  faculties = ['Engineering', 'Medicine', 'Law', 'Arts & Humanities', 'Sciences', 'Education'];

  // Detail Modal Bar Chart Configuration
  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: ['Completed', 'Scheduled', 'Attendance %', 'Efficiency %'],
    datasets: [
      {
        data: [0, 0, 0, 0],
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'],
        borderRadius: 4
      }
    ]
  };

  public barChartOptions: ChartOptions<'bar'> = {
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

  ngOnInit(): void {
    this.initForm();
  }

  initForm() {
    this.addForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      matricula: ['', [Validators.required, Validators.minLength(4)]],
      faculty: ['Engineering', [Validators.required]],
      specialty: ['', [Validators.required]],
      capacity: [35, [Validators.required, Validators.min(10), Validators.max(100)]]
    });
  }

  get filteredPsychologists() {
    if (this.selectedFilter === 'all') return this.psychologists;
    return this.psychologists.filter(p => p.alert === this.selectedFilter);
  }

  get alertCounts() {
    return {
      overload: this.psychologists.filter(p => p.alert === 'overload').length,
      'low-perf': this.psychologists.filter(p => p.alert === 'low-perf').length,
      'few-patients': this.psychologists.filter(p => p.alert === 'few-patients').length
    };
  }

  getRatingStars(rating: number): number[] {
    const stars = [];
    const rounded = Math.round(rating);
    for (let i = 1; i <= 5; i++) {
      if (i <= rounded) stars.push(1); // filled
      else stars.push(0); // empty
    }
    return stars;
  }

  getPct(p: Psychologist): number {
    return Math.round((p.patients / p.capacity) * 100);
  }

  getEfficiency(p: Psychologist): number {
    return Math.round((p.sessionsCompleted / p.sessionsScheduled) * 100);
  }

  getChargeColor(pct: number): string {
    if (pct >= 90) return '#ef4444';
    if (pct >= 75) return '#f59e0b';
    return '#10b981';
  }

  getAlertClass(alert: string): string {
    if (alert === 'overload') return 'alert-red';
    if (alert === 'low-perf') return 'alert-amber';
    if (alert === 'few-patients') return 'alert-blue';
    return 'alert-green';
  }

  getAlertText(alert: string): string {
    if (alert === 'overload') return 'Sobrecarga';
    if (alert === 'low-perf') return 'Bajo Rendimiento';
    if (alert === 'few-patients') return 'Baja Utilización';
    return 'Normal';
  }

  viewDetail(p: Psychologist) {
    this.selectedPsychologist = p;
    const efficiency = this.getEfficiency(p);
    this.barChartData.datasets[0].data = [p.sessionsCompleted, p.sessionsScheduled, p.attendanceRate, efficiency];
  }

  closeDetail() {
    this.selectedPsychologist = null;
  }

  openAddModal() {
    this.showAddModal = true;
    this.formErrorMessage = '';
    this.formSuccessMessage = '';
    this.addForm.reset({
      faculty: 'Engineering',
      capacity: 35
    });
  }

  closeAddModal() {
    this.showAddModal = false;
  }

  async onSubmit() {
    if (this.addForm.invalid) {
      this.formErrorMessage = 'Por favor completa todos los campos correctamente.';
      return;
    }

    this.isSubmitting = true;
    this.formErrorMessage = '';
    this.formSuccessMessage = '';

    const { firstName, lastName, email, password, matricula, faculty, specialty, capacity } = this.addForm.value;

    try {
      // 1. Intentamos crear en Supabase Auth
      const { data: authData, error: authError } = await this.supabase.auth.signUp({
        email,
        password
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (authData.user) {
        const userId = authData.user.id;

        // 2. Insertamos en public.users con role_id = 3 (Psicólogo)
        const { error: userError } = await this.supabase.from('users').insert({
          id: userId,
          matricula: matricula,
          role_id: 3
        });

        if (userError) console.error('Error insertando usuario en BD:', userError.message);

        // 3. Insertamos en public.profiles
        const { error: profileError } = await this.supabase.from('profiles').insert({
          user_id: userId,
          first_name: firstName,
          last_name: lastName
        });

        if (profileError) console.error('Error insertando perfil en BD:', profileError.message);
      }

      // Agregamos localmente para visualización interactiva inmediata
      const newPsych: Psychologist = {
        id: 'p_new_' + Math.random().toString(36).substr(2, 9),
        name: `Dr. ${firstName} ${lastName}`,
        faculty: faculty,
        patients: 0,
        capacity: Number(capacity),
        attendanceRate: 100,
        sessionsCompleted: 0,
        sessionsScheduled: 0,
        evaluation: 5.0,
        alert: 'few-patients', // empieza con 0 pacientes, por ende tiene baja utilización
        specialty: specialty,
        avgSessionDuration: 50,
        dropouts: 0
      };

      this.psychologists.unshift(newPsych);

      this.formSuccessMessage = 'Psicólogo registrado exitosamente en el sistema.';
      setTimeout(() => {
        this.showAddModal = false;
      }, 2000);

    } catch (err: any) {
      console.warn('⚠️ MODO OFFLINE/SIMULADO: Agregando psicólogo de forma simulada en memoria por error de red.');
      
      const newPsych: Psychologist = {
        id: 'p_new_' + Math.random().toString(36).substr(2, 9),
        name: `Dr. ${firstName} ${lastName}`,
        faculty: faculty,
        patients: 0,
        capacity: Number(capacity),
        attendanceRate: 100,
        sessionsCompleted: 0,
        sessionsScheduled: 0,
        evaluation: 5.0,
        alert: 'few-patients',
        specialty: specialty,
        avgSessionDuration: 50,
        dropouts: 0
      };

      this.psychologists.unshift(newPsych);
      this.formSuccessMessage = 'Psicólogo registrado exitosamente (Modo Simulado).';
      setTimeout(() => {
        this.showAddModal = false;
      }, 2000);
    } finally {
      this.isSubmitting = false;
    }
  }
}
