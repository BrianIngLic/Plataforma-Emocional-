import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AdminStatsService } from '../services/admin-stats.service';
import emailjs from '@emailjs/browser';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';
import localeEs from '@angular/common/locales/es';

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

  psychologists: Psychologist[] = [];

  selectedFilter: string = 'all';
  selectedPsychologist: Psychologist | null = null;
  activeTab: 'profile' | 'calendar' | 'stats' = 'profile';
  
  // Profile Edit State
  editForm!: FormGroup;
  isSavingProfile = false;

  // Calendar State
  currentMonthDate = new Date();
  calendarDays: { date: Date, isCurrentMonth: boolean, isPast: boolean, blocked: boolean, appointments: number }[] = [];

  
  // Registration Form state
  showAddModal = false;
  addForm!: FormGroup;
  formErrorMessage = '';
  formSuccessMessage = '';
  isSubmitting = false;

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
    this.initForm();
    await this.loadFaculties();
    this.psychologists = await this.adminStats.getPsychologistsWithStats();
  }

  async loadFaculties() {
    const { data, error } = await this.supabase.from('faculties').select('name');
    if (data && !error) {
      this.faculties = data.map((f: any) => f.name);
      if (this.faculties.length > 0) {
        this.addForm.patchValue({ faculty: this.faculties[0] });
      }
    } else {
      console.error('Error loading faculties:', error?.message);
    }
  }

  initForm() {
    this.addForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      matricula: ['', [Validators.required]],
      cedula: ['', [Validators.required]],
      faculty: [this.faculties.length > 0 ? this.faculties[0] : '', [Validators.required]],
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
    this.activeTab = 'profile';
    
    // Parse first name / last name
    const parts = p.name.replace('Dr. ', '').split(' ');
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
    const efficiency = this.getEfficiency(p);
    this.barChartData.datasets[0].data = [p.sessionsCompleted, p.sessionsScheduled, p.attendanceRate, efficiency];
  }

  closeDetail() {
    this.selectedPsychologist = null;
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
        .from('psychologist_settings')
        .update({ capacity: capacity })
        .eq('psychologist_id', userId);

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
      .select('scheduled_date, status')
      .eq('psychologist_id', this.selectedPsychologist.id)
      .eq('status', 'completed')
      .gte('scheduled_date', startDate.toISOString())
      .lte('scheduled_date', endDate.toISOString());

    const { data: excps } = await this.supabase
      .from('exceptions')
      .select('date')
      .or(`psychologist_id.eq.${this.selectedPsychologist.id},psychologist_id.is.null`)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString());

    const apptMap: Record<string, number> = {};
    if (appts) {
      appts.forEach((a: any) => {
        const d = a.scheduled_date.split('T')[0];
        apptMap[d] = (apptMap[d] || 0) + 1;
      });
    }

    const excpSet = new Set<string>();
    if (excps) {
      excps.forEach((e: any) => excpSet.add(e.date.split('T')[0]));
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
      faculty: 'Engineering',
      capacity: 35
    });
  }

  closeAddModal() {
    this.showAddModal = false;
    this.createdCredentials = null;
  }

  async onSubmit() {
    if (this.addForm.invalid) {
      this.formErrorMessage = 'Por favor completa todos los campos correctamente.';
      return;
    }

    this.isSubmitting = true;
    this.formErrorMessage = '';
    this.formSuccessMessage = '';

    const { firstName, lastName, email, password, matricula, cedula, faculty, specialty, capacity } = this.addForm.value;

    try {
      // 1. Usar un cliente secundario sin persistencia para no cerrar la sesión del Administrador
      const secondarySupabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });

      const { data: authData, error: authError } = await secondarySupabase.auth.signUp({
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
          role_id: 3,
          requires_password_change: true
        });

        if (userError) console.error('Error insertando usuario en BD:', userError.message);

        // 3. Insertamos en public.profiles (Añadimos facultad, cédula y email)
        const { error: profileError } = await this.supabase.from('profiles').insert({
          user_id: userId,
          first_name: firstName,
          last_name: lastName,
          faculty: faculty,
          cedula: cedula,
          email: email
        });

        if (profileError) console.error('Error insertando perfil en BD:', profileError.message);

        // 4. Guardamos la configuración del psicólogo (Capacidad de pacientes)
        const { error: settingsError } = await this.supabase.from('psychologist_settings').insert({
          psychologist_id: userId,
          capacity: capacity
        });
        
        if (settingsError) console.error('Error configurando psicólogo:', settingsError.message);
      }

      const newPsych: Psychologist = {
        id: 'p_new_' + Math.random().toString(36).substr(2, 9),
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

      this.formSuccessMessage = 'Generando credenciales...';
      this.createdCredentials = { name: `Dr. ${firstName} ${lastName}`, email, password };
      
      try {
        const pdfBase64 = await this.generateCredentialsPDF(`Dr. ${firstName} ${lastName}`, email, password, false);
        await emailjs.send(
          'service_dh74lqw',
          'template_cqpfamj',
          {
            name: `Dr. ${firstName} ${lastName}`,
            email: email,
            password: password
          },
          '2aEIeWZsxmuiq27jD'
        );
        this.formSuccessMessage = '¡Registro exitoso y correo enviado al psicólogo!';
      } catch (err) {
        console.error('Error enviando correo:', err);
        this.formSuccessMessage = 'Psicólogo registrado. Asegúrate de configurar el SMTP y desplegar la Edge Function para el envío de correos.';
      }

    } catch (err: any) {
      console.error('Error durante el registro:', err.message || err);
      
      let errorMsg = 'Error al registrar el psicólogo. ';
      if (err.message?.includes('duplicate key') || err.message?.includes('unique constraint') || err.message?.includes('already registered')) {
        errorMsg += 'La Cédula / Cód. Empleado o el Correo ya están registrados en el sistema.';
      } else {
        errorMsg += err.message || 'Verifica la conexión a la base de datos.';
      }
      
      this.formErrorMessage = errorMsg;
      this.createdCredentials = null;
    } finally {
      this.isSubmitting = false;
    }
  }

  createdCredentials: { name: string, email: string, password: string } | null = null;

  generateRandomPassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.addForm.patchValue({ password: pass });
  }

  generateCredentialsPDF(name: string, email: string, pass: string, shouldSave: boolean = true): Promise<string> {
    return new Promise((resolve) => {
      import('jspdf').then(({ jsPDF }) => {
        const doc = new jsPDF();
      
      doc.setFontSize(22);
      doc.setTextColor(37, 99, 235);
      doc.text('Plataforma de Asistencia Emocional', 105, 30, { align: 'center' });
      
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('Credenciales de Acceso Oficiales', 105, 45, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Estimado/a ${name},`, 20, 70);
      doc.text('Su cuenta como especialista clínico ha sido creada exitosamente en la plataforma.', 20, 80);
      
      doc.setDrawColor(200);
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(20, 95, 170, 50, 3, 3, 'FD');
      
      doc.setFont('helvetica', 'bold');
      doc.text('Correo electrónico:', 30, 110);
      doc.text('Contraseña temporal:', 30, 125);
      
      doc.setFont('helvetica', 'normal');
      doc.text(email, 75, 110);
      doc.text(pass, 80, 125);
      
      doc.text('Por motivos de seguridad, el sistema le exigirá cambiar esta contraseña', 20, 165);
      doc.text('en su primer inicio de sesión.', 20, 172);
      
      doc.setTextColor(37, 99, 235);
      doc.text('Enlace de acceso: https://plataforma-emocional.com', 20, 190);
      
      if (shouldSave) {
        doc.save(`Credenciales_${name.replace(/ /g, '_')}.pdf`);
      }
      
      const pdfBase64 = btoa(doc.output());
      resolve(pdfBase64);
    });
  });
}

  isResendingEmail = false;
  manualEmailSent = false;

  async sendEmail() {
    if (!this.createdCredentials) return;
    const { name, email, password } = this.createdCredentials;
    
    this.isResendingEmail = true;
    try {
      await emailjs.send(
        'service_dh74lqw',
        'template_cqpfamj',
        {
          name: name,
          email: email,
          password: password
        },
        '2aEIeWZsxmuiq27jD'
      );
      
      this.manualEmailSent = true;
    } catch (err: any) {
      console.error('Error al reenviar correo:', err);
      alert('Error enviando el correo. Detalle: ' + (err.message || 'Fallo de red'));
    } finally {
      this.isResendingEmail = false;
    }
  }
}
