import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AdminStatsService } from '../services/admin-stats.service';
import { AdminSkill8Service, HealthProfessionalItem } from '../services/admin-skill8.service';
import { DossierExportService } from '../../../core/services/dossier-export.service';
import localeEs from '@angular/common/locales/es';

registerLocaleData(localeEs, 'es');

interface StudentItem {
  id: string;
  matricula: string;
  name: string;
  faculty: string;
  celular: string;
  avatar_url: string;
  status: string;
  self_diagnosis: string;
  primaryPsychologistId: string | null;
  primaryNutritionistId: string | null;
  hasPsychologist: boolean;
  hasNutritionist: boolean;
  inPsychologistQueue?: boolean;
  inNutritionistQueue?: boolean;
}

interface SpecialistItem {
  id: string;
  role_id: number;
  role_name: string;
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
  avatar_url?: string;
}

@Component({
  selector: 'app-directory',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule, ReactiveFormsModule, BaseChartDirective],
  templateUrl: './directory.component.html',
  styleUrls: ['./directory.component.scss']
})
export class DirectoryComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private fb = inject(FormBuilder);
  private adminStats = inject(AdminStatsService);
  private adminSkill8 = inject(AdminSkill8Service);
  private dossierExport = inject(DossierExportService);

  supabase = this.supabaseService.supabase;

  // Master Data lists
  students: StudentItem[] = [];
  specialists: SpecialistItem[] = [];
  faculties: string[] = [];
  loading = true;

  // Directory UI States
  searchQuery = '';
  selectedSpecialistFilterId = ''; // Dropdown filter / selection
  
  // Notion-like Checkbox filters
  filterNoPsychologist = false;
  filterNoNutritionist = false;
  filterVirtualQueue = false;
  selectedFaculties = new Set<string>();
  selectedStatuses = new Set<string>(['active']); // Default to active

  // Reassignment & Export statuses
  isExporting: { [studentId: string]: boolean } = {};
  showStudentProfileModal = false;
  selectedStudentForProfile: StudentItem | null = null;
  isEditingSpecialists = false;
  tempPsychologistId = '';
  tempNutritionistId = '';
  activeFilterDropdown: string | null = null;
  searchFacultyQuery = '';
  searchSpecialistQuery = '';
  searchPsychologistAssignQuery = '';
  searchNutritionistAssignQuery = '';
  activeAssignDropdown: 'psychologist' | 'nutritionist' | null = null;

  showReassignStatusModal = false;
  reassignStatusSuccess = false;
  reassignStatusMessage = '';

  // Selected Specialist detail views
  selectedPsychologist: SpecialistItem | null = null;
  activeTab: 'profile' | 'calendar' | 'stats' = 'profile';
  profileContainerScrollTop = 0;

  // Forms
  editForm!: FormGroup;
  addForm!: FormGroup;

  // Specialist Detail state
  assignedPatients: any[] = [];
  availableStudents: any[] = [];
  searchStudentQuery = '';
  showAssignDropdown = false;
  
  // Detail calendar / appointments
  currentMonthDate = new Date();
  calendarDays: { date: Date, isCurrentMonth: boolean, isPast: boolean, blocked: boolean, appointments: number }[] = [];
  selectedDate: Date = new Date();
  selectedPsychologistAppointments: any[] = [];

  // Modals
  showAddModal = false;
  isSubmitting = false;
  selectedRoleToggle = 3;
  formErrorMessage = '';
  formSuccessMessage = '';
  createdUser: { name: string, email: string } | null = null;
  isResendingEmail = false;
  manualEmailSent = false;

  // Detail unassign modal
  showUnassignConfirmModal = false;
  studentIdToUnassign: string | null = null;
  studentNameToUnassign = '';
  showUnassignSuccessModal = false;
  unassignedStudentName = '';

  // Performance chart for detail view
  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [ 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul' ],
    datasets: [
      { data: [ 0, 0, 0, 0, 0, 0, 0 ], label: 'Sesiones Completadas', backgroundColor: '#6366f1' },
      { data: [ 0, 0, 0, 0, 0, 0, 0 ], label: 'Inasistencias', backgroundColor: '#ef4444' }
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
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b', font: { family: 'monospace', size: 9 } }
      }
    }
  };

  @HostListener('document:scroll')
  onScroll() {
    const scrollEl = document.querySelector('.content-body');
    if (scrollEl) {
      this.profileContainerScrollTop = scrollEl.scrollTop;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.notion-filter-item')) {
      this.activeFilterDropdown = null;
    }
    if (!target.closest('.custom-assign-dropdown')) {
      this.activeAssignDropdown = null;
    }
  }

  async ngOnInit() {
    this.initForms();
    await this.loadFaculties();
    await this.loadData();
  }

  initForms() {
    this.addForm = this.fb.group({
      role: [3, [Validators.required]],
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      matricula: ['', [Validators.required]],
      cedula: ['', [Validators.required]],
      faculty: ['', [Validators.required]],
      specialty: ['', [Validators.required]],
      capacity: [35, [Validators.required, Validators.min(1), Validators.max(200)]]
    });

    this.editForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      faculty: ['', [Validators.required]],
      specialty: ['', [Validators.required]],
      capacity: [35, [Validators.required, Validators.min(1), Validators.max(200)]]
    });
  }

  async loadFaculties() {
    const { data, error } = await this.supabase.from('faculties').select('name');
    if (data && !error) {
      this.faculties = data.map((f: any) => f.name);
      if (this.faculties.length > 0) {
        this.addForm.patchValue({ faculty: this.faculties[0] });
      }
    }
  }

  async loadData() {
    this.loading = true;
    // 1. Fetch Specialists
    this.specialists = await this.adminStats.getPsychologistsWithStats();

    // 2. Fetch Virtual Queue data
    const { data: queueData } = await this.supabase
      .from('virtual_queue')
      .select('student_id, specialty');

    const psychQueueSet = new Set<string>();
    const nutriQueueSet = new Set<string>();
    if (queueData) {
      queueData.forEach((q: any) => {
        if (q.specialty === 'psychologist') psychQueueSet.add(q.student_id);
        if (q.specialty === 'nutritionist') nutriQueueSet.add(q.student_id);
      });
    }

    // 3. Fetch All Students (including clinical records and status)
    const { data: studentsData, error: studentError } = await this.supabase
      .from('users')
      .select(`
        id,
        matricula,
        mobile_phone,
        profiles (first_name, last_name, faculty, avatar_url),
        student_clinical_records!student_id (
          primary_psychologist_id,
          primary_nutritionist_id
        ),
        patient_settings (status, self_diagnosis)
      `)
      .eq('role_id', 2);

    if (studentError) {
      console.error('Error loading students:', studentError);
      this.students = [];
    } else {
      this.students = (studentsData || []).map((u: any) => {
        const p = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles;
        const rec = Array.isArray(u.student_clinical_records) ? u.student_clinical_records[0] : u.student_clinical_records;
        const ps = Array.isArray(u.patient_settings) ? u.patient_settings[0] : u.patient_settings;

        return {
          id: u.id,
          matricula: u.matricula || '',
          name: `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Alumno sin nombre',
          faculty: p?.faculty || 'Desconocida',
          celular: u.mobile_phone || '',
          avatar_url: p?.avatar_url || '',
          status: ps?.status || 'active',
          self_diagnosis: ps?.self_diagnosis || 'Sin especificar',
          primaryPsychologistId: rec?.primary_psychologist_id || null,
          primaryNutritionistId: rec?.primary_nutritionist_id || null,
          hasPsychologist: !!rec?.primary_psychologist_id,
          hasNutritionist: !!rec?.primary_nutritionist_id,
          inPsychologistQueue: psychQueueSet.has(u.id),
          inNutritionistQueue: nutriQueueSet.has(u.id)
        };
      });
    }
    this.loading = false;
  }

  // Get filtered lists of specialists
  get psychologistsOnly(): SpecialistItem[] {
    return this.specialists.filter(s => s.role_id === 3);
  }

  get nutritionistsOnly(): SpecialistItem[] {
    return this.specialists.filter(s => s.role_id === 4);
  }

  get filteredFacultiesForFilter(): string[] {
    if (!this.searchFacultyQuery.trim()) {
      return this.faculties;
    }
    const query = this.searchFacultyQuery.toLowerCase().trim();
    return this.faculties.filter(f => f.toLowerCase().includes(query));
  }

  get filteredPsychologistsForFilter(): SpecialistItem[] {
    if (!this.searchSpecialistQuery.trim()) {
      return this.psychologistsOnly;
    }
    const query = this.searchSpecialistQuery.toLowerCase().trim();
    return this.psychologistsOnly.filter(p => p.name.toLowerCase().includes(query));
  }

  get filteredNutritionistsForFilter(): SpecialistItem[] {
    if (!this.searchSpecialistQuery.trim()) {
      return this.nutritionistsOnly;
    }
    const query = this.searchSpecialistQuery.toLowerCase().trim();
    return this.nutritionistsOnly.filter(n => n.name.toLowerCase().includes(query));
  }

  get filteredPsychologistsForAssign(): SpecialistItem[] {
    if (!this.searchPsychologistAssignQuery.trim()) {
      return this.psychologistsOnly;
    }
    const query = this.searchPsychologistAssignQuery.toLowerCase().trim();
    return this.psychologistsOnly.filter(p => p.name.toLowerCase().includes(query));
  }

  get filteredNutritionistsForAssign(): SpecialistItem[] {
    if (!this.searchNutritionistAssignQuery.trim()) {
      return this.nutritionistsOnly;
    }
    const query = this.searchNutritionistAssignQuery.toLowerCase().trim();
    return this.nutritionistsOnly.filter(n => n.name.toLowerCase().includes(query));
  }

  toggleAssignDropdown(type: 'psychologist' | 'nutritionist', event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (this.activeAssignDropdown === type) {
      this.activeAssignDropdown = null;
    } else {
      this.activeAssignDropdown = type;
      if (type === 'psychologist') {
        this.searchPsychologistAssignQuery = '';
      } else {
        this.searchNutritionistAssignQuery = '';
      }
    }
  }

  selectPsychologistAssign(id: string) {
    this.tempPsychologistId = id;
    this.activeAssignDropdown = null;
  }

  selectNutritionistAssign(id: string) {
    this.tempNutritionistId = id;
    this.activeAssignDropdown = null;
  }

  // Filtered Students matching query and Notion-style filters
  get filteredStudents(): StudentItem[] {
    return this.students.filter(student => {
      // 1. Search Query Match
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase().trim();
        const matchesQuery = student.name.toLowerCase().includes(query) ||
                             student.matricula.toLowerCase().includes(query) ||
                             student.faculty.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      // 2. Notion assignment filters
      if (this.filterNoPsychologist && student.hasPsychologist) return false;
      if (this.filterNoNutritionist && student.hasNutritionist) return false;
      if (this.filterVirtualQueue && !student.inPsychologistQueue && !student.inNutritionistQueue) return false;

      // 3. Faculty filter
      if (this.selectedFaculties.size > 0 && !this.selectedFaculties.has(student.faculty)) return false;

      // 4. Status filter
      if (this.selectedStatuses.size > 0 && !this.selectedStatuses.has(student.status)) return false;

      return true;
    });
  }

  // Dynamic dropdown selection of specialist
  onSpecialistSelectChange(event: any) {
    const specId = event.target.value;
    this.selectedSpecialistFilterId = specId;
    if (specId) {
      const match = this.specialists.find(s => s.id === specId);
      if (match) {
        this.viewDetail(match);
      }
    } else {
      this.selectedPsychologist = null;
    }
  }

  selectSpecialistFilter(id: string) {
    this.selectedSpecialistFilterId = id;
    this.activeFilterDropdown = null;
    if (id) {
      const match = this.specialists.find(s => s.id === id);
      if (match) {
        this.viewDetail(match);
      }
    } else {
      this.selectedPsychologist = null;
    }
  }

  toggleFacultyFilter(faculty: string) {
    if (this.selectedFaculties.has(faculty)) {
      this.selectedFaculties.delete(faculty);
    } else {
      this.selectedFaculties.add(faculty);
    }
  }

  toggleStatusFilter(status: string) {
    if (this.selectedStatuses.has(status)) {
      this.selectedStatuses.delete(status);
    } else {
      this.selectedStatuses.add(status);
    }
  }

  clearFilters() {
    this.filterNoPsychologist = false;
    this.filterNoNutritionist = false;
    this.filterVirtualQueue = false;
    this.selectedFaculties.clear();
    this.selectedStatuses = new Set<string>(['active']);
    this.searchQuery = '';
    this.searchFacultyQuery = '';
    this.searchSpecialistQuery = '';
    this.activeFilterDropdown = null;
  }

  toggleFilterDropdown(dropdown: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (this.activeFilterDropdown === dropdown) {
      this.activeFilterDropdown = null;
    } else {
      this.activeFilterDropdown = dropdown;
    }
  }

  hasActiveFilters(): boolean {
    return this.filterNoPsychologist || 
           this.filterNoNutritionist || 
           this.filterVirtualQueue || 
           this.selectedFaculties.size > 0 || 
           !this.selectedStatuses.has('active') || 
           this.selectedStatuses.size > 1 || 
           this.searchQuery.trim() !== '';
  }

  // YAGNI Reassign logic directly inside the table row
  async reassignSpecialist(student: StudentItem, roleId: number, specialistId: string | null) {
    // ponytail: instant inline reassignment calls direct API with minimal overhead
    const val = specialistId || null;
    try {
      const payload = {
        studentId: student.id,
        primaryPsychologistId: roleId === 3 ? val : student.primaryPsychologistId,
        primaryNutritionistId: roleId === 4 ? val : student.primaryNutritionistId
      };
      await this.adminSkill8.assignPatientToProfessionals(payload);

      // Update local state
      student.primaryPsychologistId = payload.primaryPsychologistId;
      student.primaryNutritionistId = payload.primaryNutritionistId;
      student.hasPsychologist = !!payload.primaryPsychologistId;
      student.hasNutritionist = !!payload.primaryNutritionistId;

      // Recalculate stats/capacity if viewed in background
      await this.loadData();
    } catch (err: any) {
      alert('Error al reasignar: ' + (err.message || err));
      // Revert select input values if error
      await this.loadData();
    }
  }

  // Export Dossier
  async exportPatientDossier(studentId: string, studentName: string) {
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

  async downloadPatientDossier(studentId: string, studentName: string) {
    await this.exportPatientDossier(studentId, studentName);
  }

  // Helper displays
  getRatingStars(rating: number): number[] {
    const stars = [];
    const rounded = Math.round(rating);
    for (let i = 1; i <= 5; i++) {
      stars.push(i <= rounded ? 1 : 0);
    }
    return stars;
  }

  getPct(p: SpecialistItem): number {
    return Math.round((p.patients / p.capacity) * 100);
  }

  getEfficiency(p: SpecialistItem): number {
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

  // ==========================================
  // Specialist Details view features (copied logic)
  // ==========================================
  viewDetail(p: SpecialistItem) {
    this.selectedPsychologist = p;
    this.selectedSpecialistFilterId = p.id;
    this.activeTab = 'profile';
    this.selectedDate = new Date();

    // Parse first name / last name
    const parts = p.name.replace('Dr. ', '').replace('Dra. ', '').split(' ');
    const first = parts[0] || '';
    const last = parts.slice(1).join(' ') || '';

    this.editForm.patchValue({
      firstName: first,
      lastName: last,
      faculty: p.faculty,
      specialty: p.specialty,
      capacity: p.capacity
    });

    this.generateCalendar();
    this.loadAssignedPatients();
    this.loadAvailableStudents();
    this.loadPerformanceChart(p.id);
  }

  closeDetail() {
    this.selectedPsychologist = null;
    this.selectedSpecialistFilterId = '';
  }

  setTab(tab: 'profile' | 'calendar' | 'stats') {
    this.activeTab = tab;
  }

  async saveProfileChanges() {
    if (this.editForm.invalid || !this.selectedPsychologist) return;
    this.isSavingProfile = true;

    try {
      const { firstName, lastName, faculty, specialty, capacity } = this.editForm.value;
      const userId = this.selectedPsychologist.id;

      const { error: pError } = await this.supabase
        .from('profiles')
        .update({ first_name: firstName, last_name: lastName, faculty: faculty })
        .eq('user_id', userId);

      if (pError) throw pError;

      const { error: sError } = await this.supabase
        .from('health_professional_settings')
        .update({ capacity: capacity })
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

  isSavingProfile = false;

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

  // ==========================================
  // Specialist Detail Patient List features
  // ==========================================
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
      const index = this.specialists.findIndex(p => p.id === specialist.id);
      if (index !== -1) {
        this.specialists[index].patients = this.assignedPatients.length;
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

  async confirmUnassign() {
    if (!this.studentIdToUnassign) return;
    const studentId = this.studentIdToUnassign;
    const studentName = this.studentNameToUnassign;
    
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
      const index = this.specialists.findIndex(p => p.id === specialist.id);
      if (index !== -1) {
        this.specialists[index].patients = this.assignedPatients.length;
      }
    } catch (err: any) {
      console.error('Error unassigning patient:', err);
      alert('Error al dar de baja al paciente: ' + (err.message || err));
    }
  }

  closeUnassignSuccessModal() {
    this.showUnassignSuccessModal = false;
    this.unassignedStudentName = '';
    this.updateBodyScroll();
  }

  // ==========================================
  // Student Profile modal & body scroll
  // ==========================================
  openStudentProfile(student: any) {
    const fullStudent = this.students.find(s => s.id === student.id) || student;
    this.selectedStudentForProfile = fullStudent;
    this.tempPsychologistId = fullStudent.primaryPsychologistId || '';
    this.tempNutritionistId = fullStudent.primaryNutritionistId || '';
    this.isEditingSpecialists = false;
    this.showStudentProfileModal = true;
    this.activeAssignDropdown = null;
    this.updateBodyScroll();
  }

  closeStudentProfile() {
    this.showStudentProfileModal = false;
    this.selectedStudentForProfile = null;
    this.isEditingSpecialists = false;
    this.updateBodyScroll();
  }

  getSpecialistName(id: string | null): string {
    if (!id) return 'Sin asignar';
    const match = this.specialists.find(s => s.id === id);
    return match ? match.name : 'Sin asignar';
  }

  async saveSpecialistReassignment() {
    if (!this.selectedStudentForProfile) return;
    const student = this.selectedStudentForProfile;

    // 1. Capacity limit validation
    if (this.tempPsychologistId && this.tempPsychologistId !== student.primaryPsychologistId) {
      const psych = this.specialists.find(s => s.id === this.tempPsychologistId);
      if (psych && psych.patients >= psych.capacity) {
        this.showErrorModal(`El psicólogo ${psych.name} ha alcanzado su límite máximo de capacidad (${psych.patients}/${psych.capacity} pacientes).`);
        return;
      }
    }

    if (this.tempNutritionistId && this.tempNutritionistId !== student.primaryNutritionistId) {
      const nutr = this.specialists.find(s => s.id === this.tempNutritionistId);
      if (nutr && nutr.patients >= nutr.capacity) {
        this.showErrorModal(`El nutriólogo ${nutr.name} ha alcanzado su límite máximo de capacidad (${nutr.patients}/${nutr.capacity} pacientes).`);
        return;
      }
    }

    try {
      const payload = {
        studentId: student.id,
        primaryPsychologistId: this.tempPsychologistId || null,
        primaryNutritionistId: this.tempNutritionistId || null
      };
      await this.adminSkill8.assignPatientToProfessionals(payload);

      // Update student object directly (modifies reference in list)
      student.primaryPsychologistId = payload.primaryPsychologistId;
      student.primaryNutritionistId = payload.primaryNutritionistId;
      student.hasPsychologist = !!payload.primaryPsychologistId;
      student.hasNutritionist = !!payload.primaryNutritionistId;

      this.isEditingSpecialists = false;
      await this.loadData();
      this.showSuccessModal('Asignación guardada y sincronizada con éxito.');
    } catch (err: any) {
      this.showErrorModal('Error al guardar asignación: ' + (err.message || err));
    }
  }

  showSuccessModal(msg: string) {
    this.reassignStatusSuccess = true;
    this.reassignStatusMessage = msg;
    this.showReassignStatusModal = true;
    this.updateBodyScroll();
  }

  showErrorModal(msg: string) {
    this.reassignStatusSuccess = false;
    this.reassignStatusMessage = msg;
    this.showReassignStatusModal = true;
    this.updateBodyScroll();
  }

  closeReassignStatusModal() {
    this.showReassignStatusModal = false;
    this.updateBodyScroll();
  }

  updateBodyScroll() {
    const isModalOpen = this.showAddModal || this.showStudentProfileModal || this.showUnassignConfirmModal || this.showUnassignSuccessModal || this.showReassignStatusModal;
    if (isModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }

  // ==========================================
  // Invite / Register new health professional
  // ==========================================
  openAddModal() {
    this.showAddModal = true;
    this.formErrorMessage = '';
    this.formSuccessMessage = '';
    this.addForm.reset({
      role: 3,
      capacity: 35,
      faculty: this.faculties.length > 0 ? this.faculties[0] : ''
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

    const { role, firstName, lastName, email, matricula, cedula, faculty, specialty, capacity } = this.addForm.value;
    const roleName = Number(role) === 4 ? 'Nutriólogo' : 'Psicólogo';

    try {
      const { data, error } = await this.supabase.functions.invoke('invite-user', {
        body: { email, matricula, firstName, lastName, faculty, cedula, capacity, role: Number(role) }
      });

      if (error || (data && data.error)) {
        throw new Error(error?.message || data?.error || 'Error invitando especialista');
      }

      this.createdUser = { name: `Dr. ${firstName} ${lastName}`, email };
      this.formSuccessMessage = `¡Registro exitoso! Invitación oficial enviada por Supabase al ${roleName.toLowerCase()}.`;

      // Reload specialist list
      await this.loadData();
    } catch (err: any) {
      console.error('Error durante el registro:', err);
      this.formErrorMessage = 'Error al registrar: ' + (err.message || err);
    } finally {
      this.isSubmitting = false;
    }
  }

  async sendEmail() {
    if (!this.createdUser) return;
    const { email } = this.createdUser;
    
    this.isResendingEmail = true;
    try {
      await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth/reset-password',
      });
      this.manualEmailSent = true;
    } catch (err: any) {
      console.error('Error al reenviar correo:', err);
      alert('Error enviando el correo: ' + (err.message || err));
    } finally {
      this.isResendingEmail = false;
    }
  }
}
