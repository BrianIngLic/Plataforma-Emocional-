import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AdminStatsService } from '../services/admin-stats.service';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';
import localeEs from '@angular/common/locales/es';
import { DossierExportService } from '../../../core/services/dossier-export.service';
import { AdminSkill8Service } from '../services/admin-skill8.service';
import { FacultyService } from '../../../core/services/faculty.service';

registerLocaleData(localeEs, 'es');

interface Psychologist {
  id: string;
  name: string;
  email: string;
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
  role_id?: number;
  role_name?: string;
  avatar_url?: string;
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
  adminStats = inject(AdminStatsService);
  adminSkill8 = inject(AdminSkill8Service);
  dossierExport = inject(DossierExportService);
  facultyService = inject(FacultyService);

  psychologists: Psychologist[] = [];
  loading = true;
  allFacultiesData: any[] = [];
  buildings: any[] = [];
  editBuildings: any[] = [];

  showNewBuildingForm = false;
  showEditNewBuildingForm = false;
  newBuildingName = '';
  newBuildingCode = '';

  // Patient Management State
  assignedPatients: any[] = [];
  availableStudents: any[] = [];
  searchStudentQuery = '';
  showAssignDropdown = false;
  isExporting: { [studentId: string]: boolean } = {};
  selectedStudentForProfile: any = null;
  showStudentProfileModal = false;

  // Unassign Confirm Modal State
  showUnassignConfirmModal = false;
  studentIdToUnassign: string | null = null;
  studentNameToUnassign = '';
  showUnassignSuccessModal = false;
  unassignedStudentName = '';

  selectedFilter: string = 'all';
  selectedPsychologist: Psychologist | null = null;
  activeTab: 'profile' | 'calendar' | 'stats' | 'evaluations' = 'profile';
  evaluations: any[] = [];
  filteredEvaluations: any[] = [];
  selectedPatientFilterId = 'all';

  profileContainerScrollTop = 0;

  @HostListener('document:scroll', ['$event'])
  onScroll(event?: Event) {
    const scrollEl = document.querySelector('.content-body');
    if (scrollEl) {
      this.profileContainerScrollTop = scrollEl.scrollTop;
    }
  }
  
  // Profile Edit State
  editForm!: FormGroup;
  isSavingProfile = false;

  // Calendar State
  currentMonthDate = new Date();
  calendarDays: { date: Date, isCurrentMonth: boolean, isPast: boolean, blocked: boolean, appointments: number }[] = [];
  selectedDate: Date = new Date();
  selectedPsychologistAppointments: any[] = [];

  get appointmentsForSelectedDate() {
    if (!this.selectedDate) return [];
    const tzOffset = this.selectedDate.getTimezoneOffset() * 60000;
    const selStr = new Date(this.selectedDate.getTime() - tzOffset).toISOString().split('T')[0];
    return this.selectedPsychologistAppointments.filter((a: any) => {
      const dStr = a.scheduled_date.split('T')[0];
      return dStr === selStr;
    }).sort((a: any, b: any) => {
      return a.scheduled_date.localeCompare(b.scheduled_date);
    });
  }

  
  // Registration Form state
  showAddModal = false;
  addForm!: FormGroup;
  formErrorMessage = '';
  formSuccessMessage = '';
  isSubmitting = false;
  selectedRoleToggle: number = 3; // 3 = Psicólogo, 4 = Nutriólogo

  faculties: string[] = [];

  // Chart Data
  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [ 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul' ],
    datasets: [
      { data: [ 65, 59, 80, 81, 56, 55, 40 ], label: 'Sesiones Completadas', backgroundColor: '#6366f1' },
      { data: [ 28, 48, 40, 19, 86, 27, 90 ], label: 'Inasistencias', backgroundColor: '#ef4444' }
    ]
  };

  public barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { family: 'monospace', size: 9 } }
      },
      y: {
        grid: { color: 'rgba(0, 0, 0, 0.1)' },
        ticks: { color: '#64748b', font: { family: 'monospace', size: 9 } }
      }
    }
  };

  async ngOnInit() {
    this.loading = true;
    this.initForm();
    await this.loadFaculties();
    this.psychologists = await this.adminStats.getPsychologistsWithStats();
    this.loading = false;
    
    // Initialize scroll position
    setTimeout(() => {
      this.onScroll();
    }, 100);
  }

  async loadFaculties() {
    const { data, error } = await this.supabase.from('faculties').select('id, name');
    if (data && !error) {
      this.allFacultiesData = data;
      this.faculties = data.map((f: any) => f.name);
      if (this.faculties.length > 0) {
        this.addForm.patchValue({ faculty: this.faculties[0] });
        await this.onAddFacultyChange(this.faculties[0]);
      }
    } else {
      console.error('Error loading faculties:', error?.message);
    }
  }

  async onAddFacultyChange(facName: string) {
    const fac = this.allFacultiesData.find(f => f.name === facName);
    if (fac) {
      this.buildings = await this.facultyService.getBuildingsByFaculty(fac.id);
      if (this.buildings.length > 0) {
        this.addForm.patchValue({ building_id: this.buildings[0].id });
      } else {
        this.addForm.patchValue({ building_id: null });
      }
    } else {
      this.buildings = [];
      this.addForm.patchValue({ building_id: null });
    }
  }

  async onEditFacultyChange(facName: string) {
    const fac = this.allFacultiesData.find(f => f.name === facName);
    if (fac) {
      this.editBuildings = await this.facultyService.getBuildingsByFaculty(fac.id);
      if (this.editBuildings.length > 0) {
        const currentBId = this.editForm.value.building_id;
        if (!this.editBuildings.some(b => b.id === currentBId)) {
          this.editForm.patchValue({ building_id: this.editBuildings[0].id });
        }
      } else {
        this.editForm.patchValue({ building_id: null });
      }
    } else {
      this.editBuildings = [];
      this.editForm.patchValue({ building_id: null });
    }
  }

  initForm() {
    this.addForm = this.fb.group({
      role: [3, [Validators.required]],
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      matricula: ['', [Validators.required]],
      cedula: ['', [Validators.required]],
      faculty: [this.faculties.length > 0 ? this.faculties[0] : '', [Validators.required]],
      building_id: [null],
      office_room: [''],
      specialty: ['', [Validators.required]],
      capacity: [35, [Validators.required, Validators.min(1), Validators.max(200)]]
    });

    this.editForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      faculty: ['', [Validators.required]],
      building_id: [null],
      office_room: [''],
      specialty: ['', [Validators.required]],
      capacity: [35, [Validators.required, Validators.min(1), Validators.max(200)]]
    });

    this.addForm.get('faculty')?.valueChanges.subscribe(async (facName) => {
      await this.onAddFacultyChange(facName || '');
    });

    this.editForm.get('faculty')?.valueChanges.subscribe(async (facName) => {
      await this.onEditFacultyChange(facName || '');
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

  isPastAppointment(appt: any): boolean {
    if (!appt.scheduled_date) return false;
    const apptDate = new Date(appt.scheduled_date);
    const today = new Date();
    today.setHours(0,0,0,0);
    return apptDate < today;
  }

  isAlertAppointment(appt: any): boolean {
    const isPast = this.isPastAppointment(appt);
    const hasNoNote = !appt.notes || appt.notes.trim() === '';
    const isNotNoShow = appt.status !== 'no_show';
    return isPast && hasNoNote && isNotNoShow;
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

  async viewDetail(p: Psychologist) {
    this.selectedPsychologist = p;
    this.activeTab = 'profile';
    this.selectedDate = new Date();
    
    // Parse first name / last name
    const parts = p.name.replace('Dr. ', '').split(' ');
    const first = parts[0] || '';
    const last = parts.slice(1).join(' ') || '';

    // Obtener configuración del especialista de la base de datos
    const { data: settings } = await this.supabase
      .from('health_professional_settings')
      .select('building_id, office_room')
      .eq('professional_id', p.id)
      .maybeSingle();

    // Cargar edificios para la facultad antes de parchar
    const fac = this.allFacultiesData.find(f => f.name === p.faculty);
    if (fac) {
      this.editBuildings = await this.facultyService.getBuildingsByFaculty(fac.id);
    } else {
      this.editBuildings = [];
    }

    this.editForm.patchValue({
      firstName: first,
      lastName: last,
      faculty: p.faculty,
      building_id: settings?.building_id || null,
      office_room: settings?.office_room || '',
      specialty: p.specialty,
      capacity: p.capacity
    });

    this.selectedPatientFilterId = 'all';
    this.evaluations = [];
    this.filteredEvaluations = [];

    this.generateCalendar();
    this.loadAssignedPatients();
    this.loadAvailableStudents();
    this.loadPerformanceChart(p.id);
    this.loadEvaluations(p.id);
  }

  closeDetail() {
    this.selectedPsychologist = null;
  }

  setTab(tab: 'profile' | 'calendar' | 'stats' | 'evaluations') {
    this.activeTab = tab;
  }

  async loadEvaluations(professionalId: string) {
    const { data, error } = await this.supabase
      .from('session_evaluations')
      .select(`
        id,
        appointment_id,
        patient_id,
        professional_id,
        q1_global,
        q2_bond,
        q3_goals,
        q4_impact,
        q5_comment,
        score_global,
        rupture_flag,
        created_at
      `)
      .eq('professional_id', professionalId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading evaluations:', error);
      this.evaluations = [];
      this.filteredEvaluations = [];
      return;
    }

    // Resolve patient profiles
    const patientIds = (data || []).map(e => e.patient_id).filter(Boolean);
    const { data: patientProfiles } = await this.supabase
      .from('profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', patientIds);

    const profilesMap = new Map<string, string>();
    if (patientProfiles) {
      patientProfiles.forEach(p => {
        profilesMap.set(p.user_id, `${p.first_name || ''} ${p.last_name || ''}`.trim());
      });
    }

    this.evaluations = (data || []).map(e => ({
      ...e,
      patientName: profilesMap.get(e.patient_id) || 'Estudiante Desconocido'
    }));

    this.applyEvaluationsFilter();
  }

  applyEvaluationsFilter() {
    if (this.selectedPatientFilterId === 'all') {
      this.filteredEvaluations = this.evaluations;
    } else {
      this.filteredEvaluations = this.evaluations.filter(e => e.patient_id === this.selectedPatientFilterId);
    }
  }

  async saveProfileChanges() {
    if (this.editForm.invalid || !this.selectedPsychologist) return;
    this.isSavingProfile = true;

    try {
      const { firstName, lastName, faculty, specialty, capacity, building_id, office_room } = this.editForm.value;
      const userId = this.selectedPsychologist.id;

      const fac = this.allFacultiesData.find(f => f.name === faculty);

      const { error: pError } = await this.supabase
        .from('profiles')
        .update({ first_name: firstName, last_name: lastName, faculty: faculty })
        .eq('user_id', userId);

      if (pError) throw pError;

      const { error: sError } = await this.supabase
        .from('health_professional_settings')
        .update({ 
          capacity: capacity,
          building_id: building_id || null,
          office_room: office_room || '',
          faculty_id: fac ? fac.id : null
        })
        .eq('professional_id', userId);

      if (sError) throw sError;

      // Update local memory
      this.selectedPsychologist.name = `Dr. ${firstName} ${lastName}`;
      this.selectedPsychologist.faculty = faculty;
      this.selectedPsychologist.specialty = specialty;
      this.selectedPsychologist.capacity = capacity;

      alert('Perfil actualizado correctamente.');
    } catch (err) {
      console.error('Error guardando perfil:', err);
      alert('Hubo un error al actualizar el perfil.');
    } finally {
      this.isSavingProfile = false;
    }
  }

  async generateCalendar() {
    if (!this.selectedPsychologist) return;

    const year = this.currentMonthDate.getFullYear();
    const month = this.currentMonthDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Sunday start

    const endDate = new Date(lastDay);
    if (endDate.getDay() !== 6) {
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // Saturday end
    }

    const { data: appts } = await this.supabase
      .from('appointments')
      .select(`
        id,
        scheduled_date,
        start_time,
        end_time,
        status,
        notes,
        priority_level,
        patient:users!student_id (
          profiles (
            first_name,
            last_name,
            faculty
          )
        )
      `)
      .eq('professional_id', this.selectedPsychologist.id)
      .gte('scheduled_date', startDate.toISOString())
      .lte('scheduled_date', endDate.toISOString());

    const { data: excps } = await this.supabase
      .from('health_professional_exceptions')
      .select('exception_date')
      .or(`professional_id.eq.${this.selectedPsychologist.id},professional_id.is.null`)
      .gte('exception_date', startDate.toISOString())
      .lte('exception_date', endDate.toISOString());

    const apptMap: Record<string, number> = {};
    const allAppointments: any[] = [];
    if (appts) {
      appts.forEach((a: any) => {
        if (a.status !== 'canceled' && a.status !== 'cancelled') {
          const d = a.scheduled_date.split('T')[0];
          apptMap[d] = (apptMap[d] || 0) + 1;
          allAppointments.push(a);
        }
      });
    }
    this.selectedPsychologistAppointments = allAppointments;

    const excpSet = new Set<string>();
    if (excps) {
      excps.forEach((e: any) => {
        if (e.exception_date) {
          excpSet.add(e.exception_date.split('T')[0]);
        }
      });
    }

    const days = [];
    let d = new Date(startDate);
    const today = new Date();
    today.setHours(0,0,0,0);

    while (d <= endDate) {
      const isStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      days.push({
        date: new Date(d),
        isCurrentMonth: d.getMonth() === month,
        isPast: d < today,
        blocked: excpSet.has(isStr),
        appointments: apptMap[isStr] || 0
      });
      d.setDate(d.getDate() + 1);
    }

    this.calendarDays = days;
  }

  prevMonth() {
    this.currentMonthDate = new Date(this.currentMonthDate.getFullYear(), this.currentMonthDate.getMonth() - 1, 1);
    this.generateCalendar();
  }

  nextMonth() {
    this.currentMonthDate = new Date(this.currentMonthDate.getFullYear(), this.currentMonthDate.getMonth() + 1, 1);
    this.generateCalendar();
  }

  openAddModal() {
    this.showAddModal = true;
    this.formErrorMessage = '';
    this.formSuccessMessage = '';
    this.addForm.reset({
      role: 3,
      capacity: 35
    });
    this.selectedRoleToggle = 3;
    this.updateBodyScroll();
  }

  closeAddModal() {
    this.showAddModal = false;
    this.createdUser = null;
    this.updateBodyScroll();
  }

  async onSubmit() {
    if (this.addForm.invalid) {
      this.formErrorMessage = 'Por favor completa todos los campos correctamente.';
      return;
    }

    this.isSubmitting = true;
    this.formErrorMessage = '';
    this.formSuccessMessage = '';

    const { role, firstName, lastName, email, matricula, cedula, faculty, specialty, capacity, building_id, office_room } = this.addForm.value;
    const roleName = Number(role) === 4 ? 'Nutriólogo' : 'Psicólogo';

    try {
      // 1. Invocar la Edge Function segura para invitar al profesional de la salud en Supabase Auth
      // Sin exponer contraseñas en texto plano ni usar clientes secundarios
      const { data, error } = await this.supabase.functions.invoke('invite-user', {
        body: { email, matricula, firstName, lastName, faculty, cedula, capacity, role: Number(role) }
      });

      if (error || (data && data.error)) {
        throw new Error(error?.message || data?.error || 'Error invocando Edge Function invite-user');
      }

      const newPsych: Psychologist = {
        id: 'p_new_' + Math.random().toString(36).substr(2, 9),
        role_id: Number(role),
        role_name: roleName,
        name: `Dr. ${firstName} ${lastName}`,
        email: email,
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

      // Actualizar building_id, office_room y faculty_id del profesional registrado
      let profId = data?.user_id || data?.id;
      if (!profId) {
        const { data: profUser } = await this.supabase
          .from('profiles')
          .select('user_id')
          .eq('email', email)
          .maybeSingle();
        profId = profUser?.user_id;
      }

      if (profId) {
        const facObj = this.allFacultiesData.find(f => f.name === faculty);
        await this.supabase
          .from('health_professional_settings')
          .update({
            building_id: building_id || null,
            office_room: office_room || '',
            faculty_id: facObj ? facObj.id : null
          })
          .eq('professional_id', profId);
      }

      this.createdUser = { name: `Dr. ${firstName} ${lastName}`, email };
      this.formSuccessMessage = `¡Registro exitoso! Invitación oficial enviada por Supabase al ${roleName.toLowerCase()}.`;

    } catch (err: any) {
      console.error('Error durante el registro:', err.message || err);
      
      const errorStr = (err.message || err).toString();
      let errorMsg = 'Error al registrar el psicólogo: ';
      
      if (errorStr.includes('duplicate key') || errorStr.includes('unique constraint') || errorStr.includes('already registered') || errorStr.includes('non-2xx') || errorStr.includes('Edge Function') || errorStr.includes('email_exists')) {
        errorMsg += 'La Cédula, Código de Empleado o el Correo electrónico ingresados ya se encuentran registrados en el sistema.';
      } else {
        errorMsg += errorStr || 'Verifica la conexión a la base de datos.';
      }
      
      this.formErrorMessage = errorMsg;
      this.createdUser = null;
    } finally {
      this.isSubmitting = false;
    }
  }

  toggleAddBuildingForm() {
    this.showNewBuildingForm = !this.showNewBuildingForm;
    this.newBuildingName = '';
    this.newBuildingCode = '';
  }

  toggleEditAddBuildingForm() {
    this.showEditNewBuildingForm = !this.showEditNewBuildingForm;
    this.newBuildingName = '';
    this.newBuildingCode = '';
  }

  async addNewBuilding(isEditForm: boolean) {
    const formGroup = isEditForm ? this.editForm : this.addForm;
    const facName = formGroup.get('faculty')?.value;
    if (!facName || !this.newBuildingName.trim()) return;

    const fac = this.allFacultiesData.find(f => f.name === facName);
    if (!fac) return;

    const { data, error } = await this.facultyService.createBuilding(
      fac.id,
      this.newBuildingName.trim(),
      this.newBuildingCode.trim() || undefined
    );

    if (error) {
      alert('Error al crear el edificio: ' + (error.message || error));
      return;
    }

    if (data) {
      if (isEditForm) {
        this.editBuildings = await this.facultyService.getBuildingsByFaculty(fac.id);
        this.editForm.patchValue({ building_id: data.id });
        this.showEditNewBuildingForm = false;
      } else {
        this.buildings = await this.facultyService.getBuildingsByFaculty(fac.id);
        this.addForm.patchValue({ building_id: data.id });
        this.showNewBuildingForm = false;
      }
      this.newBuildingName = '';
      this.newBuildingCode = '';
    }
  }

  createdUser: { name: string, email: string } | null = null;

  isResendingEmail = false;
  manualEmailSent = false;

  async sendEmail() {
    if (!this.createdUser) return;
    const { email } = this.createdUser;
    
    this.isResendingEmail = true;
    try {
      // Re-enviar invitación o restablecimiento nativo de Supabase Auth
      await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth/reset-password',
      });
      
      this.manualEmailSent = true;
    } catch (err: any) {
      console.error('Error al reenviar correo:', err);
      alert('Error enviando el correo. Detalle: ' + (err.message || 'Fallo de red'));
    } finally {
      this.isResendingEmail = false;
    }
  }

  // Patient Management Methods
  async loadAssignedPatients() {
    if (!this.selectedPsychologist) return;
    const specialist = this.selectedPsychologist;
    const field = specialist.role_id === 4 ? 'primary_nutritionist_id' : 'primary_psychologist_id';
    
    const { data, error } = await this.supabase
      .from('student_clinical_records')
      .select(`
        student_id,
        student:users!student_id (
          id,
          matricula,
          mobile_phone,
          profiles (
            first_name,
            last_name,
            faculty
          )
        )
      `)
      .eq(field, specialist.id);

    if (error) {
      console.error('Error loading assigned patients:', error);
      this.assignedPatients = [];
    } else {
      this.assignedPatients = (data || []).map((d: any) => {
        const student = d.student;
        if (student) {
          student.email = student.matricula ? `${student.matricula}@ep.buap.mx` : '';
          const p = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
          if (p) {
            p.celular = student.mobile_phone || '';
          }
        }
        return student;
      }).filter(Boolean);
    }
  }

  async loadAvailableStudents() {
    const { data, error } = await this.supabase
      .from('users')
      .select(`
        id,
        matricula,
        mobile_phone,
        profiles (
          first_name,
          last_name,
          faculty
        )
      `)
      .eq('role_id', 2);

    if (error) {
      console.error('Error loading available students:', error);
      this.availableStudents = [];
    } else {
      this.availableStudents = (data || []).map((student: any) => {
        student.email = student.matricula ? `${student.matricula}@ep.buap.mx` : '';
        const p = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
        if (p) {
          p.celular = student.mobile_phone || '';
        }
        return student;
      });
    }
  }

  get filteredAvailableStudents() {
    if (!this.searchStudentQuery.trim()) {
      return [];
    }
    const query = this.searchStudentQuery.toLowerCase().trim();
    const assignedIds = new Set(this.assignedPatients.map(p => p.id));
    return this.availableStudents.filter(s => {
      if (assignedIds.has(s.id)) return false;
      const firstName = s.profiles?.first_name?.toLowerCase() || '';
      const lastName = s.profiles?.last_name?.toLowerCase() || '';
      const matricula = s.matricula?.toLowerCase() || '';
      return firstName.includes(query) || lastName.includes(query) || matricula.includes(query);
    });
  }

  async assignPatient(studentId: string) {
    if (!this.selectedPsychologist) return;
    const specialist = this.selectedPsychologist;
    const isNutritionist = specialist.role_id === 4;

    try {
      const { data: currentRecord } = await this.supabase
        .from('student_clinical_records')
        .select('primary_psychologist_id, primary_nutritionist_id')
        .eq('student_id', studentId)
        .maybeSingle();

      const payload = {
        studentId,
        primaryPsychologistId: isNutritionist ? currentRecord?.primary_psychologist_id : specialist.id,
        primaryNutritionistId: isNutritionist ? specialist.id : currentRecord?.primary_nutritionist_id
      };

      await this.adminSkill8.assignPatientToProfessionals(payload);
      
      this.searchStudentQuery = '';
      this.showAssignDropdown = false;
      await this.loadAssignedPatients();
      
      this.selectedPsychologist.patients = this.assignedPatients.length;
      const index = this.psychologists.findIndex(p => p.id === specialist.id);
      if (index !== -1) {
        this.psychologists[index].patients = this.assignedPatients.length;
      }
    } catch (err: any) {
      console.error('Error assigning patient:', err);
      alert('Error al asignar el paciente: ' + (err.message || err));
    }
  }

  openUnassignModal(studentId: string, studentName: string) {
    this.studentIdToUnassign = studentId;
    this.studentNameToUnassign = studentName;
    this.showUnassignConfirmModal = true;
    this.updateBodyScroll();
  }

  closeUnassignModal() {
    this.showUnassignConfirmModal = false;
    this.studentIdToUnassign = null;
    this.studentNameToUnassign = '';
    this.updateBodyScroll();
  }

  openStudentProfile(student: any) {
    this.selectedStudentForProfile = student;
    this.showStudentProfileModal = true;
    this.updateBodyScroll();
  }

  closeStudentProfile() {
    this.showStudentProfileModal = false;
    this.selectedStudentForProfile = null;
    this.updateBodyScroll();
  }

  closeUnassignSuccessModal() {
    this.showUnassignSuccessModal = false;
    this.unassignedStudentName = '';
    this.updateBodyScroll();
  }

  updateBodyScroll() {
    const isModalOpen = this.showAddModal || this.showStudentProfileModal || this.showUnassignConfirmModal || this.showUnassignSuccessModal;
    if (isModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }

  async confirmUnassign() {
    if (!this.studentIdToUnassign) return;
    const studentId = this.studentIdToUnassign;
    const studentName = this.studentNameToUnassign;
    
    // Close confirmation modal, but don't update body scroll classes yet
    this.showUnassignConfirmModal = false;
    this.studentIdToUnassign = null;
    this.studentNameToUnassign = '';
    
    try {
      await this.unassignPatient(studentId);
      this.unassignedStudentName = studentName;
      this.showUnassignSuccessModal = true;
      this.updateBodyScroll();
    } catch (err) {
      this.updateBodyScroll();
    }
  }

  async unassignPatient(studentId: string) {
    if (!this.selectedPsychologist) return;
    
    const specialist = this.selectedPsychologist;
    const isNutritionist = specialist.role_id === 4;

    try {
      const { data: currentRecord } = await this.supabase
        .from('student_clinical_records')
        .select('primary_psychologist_id, primary_nutritionist_id')
        .eq('student_id', studentId)
        .maybeSingle();

      const payload = {
        studentId,
        primaryPsychologistId: isNutritionist ? currentRecord?.primary_psychologist_id : null,
        primaryNutritionistId: isNutritionist ? null : currentRecord?.primary_nutritionist_id
      };

      await this.adminSkill8.assignPatientToProfessionals(payload);
      await this.loadAssignedPatients();

      this.selectedPsychologist.patients = this.assignedPatients.length;
      const index = this.psychologists.findIndex(p => p.id === specialist.id);
      if (index !== -1) {
        this.psychologists[index].patients = this.assignedPatients.length;
      }
    } catch (err: any) {
      console.error('Error unassigning patient:', err);
      alert('Error al dar de baja al paciente: ' + (err.message || err));
    }
  }

  async downloadPatientDossier(studentId: string, studentName: string) {
    this.isExporting[studentId] = true;
    try {
      const blob = await this.dossierExport.exportDossier(studentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dossier_clinico_${studentName.replace(/\s+/g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al exportar dossier:', err);
      alert('Error al generar el dossier clínico.');
    } finally {
      this.isExporting[studentId] = false;
    }
  }

  // Dynamic Chart Loading Method
  async loadPerformanceChart(professionalId: string) {
    const today = new Date();
    const startOfRange = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    
    const { data, error } = await this.supabase
      .from('appointments')
      .select('scheduled_date, status')
      .eq('professional_id', professionalId)
      .gte('scheduled_date', startOfRange.toISOString());
      
    if (error) {
      console.error('Error loading chart data:', error);
      return;
    }
    
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const labels: string[] = [];
    const completedData: number[] = [0, 0, 0, 0, 0, 0];
    const noShowData: number[] = [0, 0, 0, 0, 0, 0];
    
    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      labels.push(monthNames[d.getMonth()]);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthKeys.push(monthKey);
    }
    
    if (data) {
      data.forEach((a: any) => {
        const date = new Date(a.scheduled_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const index = monthKeys.indexOf(monthKey);
        if (index !== -1) {
          if (a.status === 'completed') {
            completedData[index]++;
          } else if (a.status === 'no_show' || a.status === 'cancelled') {
            noShowData[index]++;
          }
        }
      });
    }
    
    this.barChartData = {
      labels: labels,
      datasets: [
        { data: completedData, label: 'Sesiones Completadas', backgroundColor: '#6366f1' },
        { data: noShowData, label: 'Inasistencias', backgroundColor: '#ef4444' }
      ]
    };
  }
}
