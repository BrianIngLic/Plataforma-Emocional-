import { inject } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export abstract class HealthProfessionalBase {
  protected supabaseService = inject(SupabaseService);
  protected authService = inject(AuthService);
  protected router = inject(Router);

  public supabase = this.supabaseService.supabase;
  public searchTerm: string = '';
  public globalSearchTerm: string = '';
  public showGlobalModal: boolean = false;
  public patientsData: any[] = [];
  public allPatients: any[] = [];
  public professionalFaculty: string | null = null;

  get currentUserId() {
    return this.authService.currentUser()?.id;
  }

  get currentUserRole() {
    return this.authService.currentUser()?.role || 'Psicologo';
  }

  get isPsychologist(): boolean {
    return this.currentUserRole === 'Psicologo';
  }

  get isNutritionist(): boolean {
    return this.currentUserRole === 'Nutricionista';
  }

  get professionalTitle(): string {
    return this.isNutritionist ? 'Nutricionista' : 'Psicólogo';
  }

  get myPatients() {
    return this.patientsData.filter(p => p.assignedId === this.currentUserId);
  }

  get filteredPatients() {
    const term = this.searchTerm.toLowerCase();
    return this.myPatients.filter(p => 
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(term) ||
      (p.diagnosis && p.diagnosis.toLowerCase().includes(term))
    );
  }

  get filteredGlobalPatients() {
    const term = this.globalSearchTerm.toLowerCase();
    let global = this.allPatients.filter(p => !p.isAssigned);
    if (this.professionalFaculty) {
      global = global.filter(p => p.faculty && p.faculty.toLowerCase().trim() === this.professionalFaculty!.toLowerCase().trim());
    }
    return global.filter(p => 
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(term) ||
      (p.matricula && p.matricula.toLowerCase().includes(term))
    );
  }

  private isFutureOrToday(dateValue: any): boolean {
    const key = this.getDateKey(dateValue);
    if (!key) return false;
    return key >= this.getDateKey(new Date().toISOString());
  }

  private isActiveAppointmentStatus(status: any): boolean {
    return !['cancelled', 'no_show'].includes(String(status || '').toLowerCase());
  }

  private getDateKey(value: any): string {
    if (!value) return '';
    return String(value).substring(0, 10);
  }

  private compareDateKeys(a: string, b: string): number {
    return a.localeCompare(b);
  }

  private formatSessionDate(value: any): string {
    const key = this.getDateKey(value);
    return key || 'Sin registro';
  }

  private getPatientSessions(appointments: any[], patientId: string) {
    const patientAppointments = appointments.filter(appt => appt.student_id === patientId);

    const lastCompleted = [...patientAppointments]
      .filter(appt => appt.status === 'completed' && appt.scheduled_date)
      .sort((a, b) => this.compareDateKeys(this.getDateKey(a.scheduled_date), this.getDateKey(b.scheduled_date)))
      .pop();

    const nextScheduled = [...patientAppointments]
      .filter(appt => this.isFutureOrToday(appt.scheduled_date) && this.isActiveAppointmentStatus(appt.status))
      .sort((a, b) => this.compareDateKeys(this.getDateKey(a.scheduled_date), this.getDateKey(b.scheduled_date)))[0];

    return {
      lastSession: lastCompleted ? this.formatSessionDate(lastCompleted.scheduled_date) : 'Sin registro',
      nextSession: nextScheduled ? this.formatSessionDate(nextScheduled.scheduled_date) : 'Por agendar'
    };
  }

  async loadPatientsBase() {
    if (this.currentUserId) {
      const { data: sett } = await this.supabase
        .from('health_professional_settings')
        .select('*, faculties(name)')
        .eq('professional_id', this.currentUserId)
        .maybeSingle();

      if (sett && sett.faculties) {
        this.professionalFaculty = Array.isArray(sett.faculties) ? sett.faculties[0]?.name : sett.faculties?.name;
      }

      if (!this.professionalFaculty) {
        const { data: prof } = await this.supabase
          .from('profiles')
          .select('faculty')
          .eq('user_id', this.currentUserId)
          .maybeSingle();
        if (prof && prof.faculty) {
          this.professionalFaculty = prof.faculty;
        }
      }
    }

    const { data, error } = await this.supabase
      .from('users')
      .select('id, matricula, profiles(first_name, last_name, avatar_url, faculty), student_clinical_records!student_clinical_records_student_id_fkey(known_conditions, primary_psychologist_id, primary_nutritionist_id)')
      .eq('role_id', 2);

    if (error) {
      console.error('Error cargando pacientes:', error.message);
      this.patientsData = [];
      this.allPatients = [];
      return;
    }

    if (data) {
      const patientIds = data.map((u: any) => u.id);
      let appointments: any[] = [];

      if (this.currentUserId && patientIds.length > 0) {
        const { data: appointmentsData, error: appointmentsError } = await this.supabase
          .from('appointments')
          .select('id, student_id, scheduled_date, status, professional_id, psychologist_id')
          .in('student_id', patientIds)
          .order('scheduled_date', { ascending: true });

        if (appointmentsError) {
          console.error('Error cargando citas de pacientes:', appointmentsError.message);
        } else {
          const byId = new Map<string, any>();
          for (const appt of appointmentsData || []) {
            byId.set(appt.id, appt);
          }
          appointments = Array.from(byId.values());
        }
      }

      this.patientsData = data.map((u: any) => {
        const records = u.student_clinical_records;
        const recordObj = Array.isArray(records) ? records[0] : records;
        const conditions = recordObj?.known_conditions;
        const diagnosis = conditions && conditions.length > 0 ? conditions.join(', ') : "Evaluación Pendiente";
        
        const assignedId = this.isNutritionist ? recordObj?.primary_nutritionist_id : recordObj?.primary_psychologist_id;
        const sessionData = this.getPatientSessions(appointments, u.id);

        return {
          id: u.id,
          matricula: u.matricula,
          firstName: Array.isArray(u.profiles) ? u.profiles[0]?.first_name : u.profiles?.first_name,
          lastName: Array.isArray(u.profiles) ? u.profiles[0]?.last_name : u.profiles?.last_name,
          avatarUrl: Array.isArray(u.profiles) ? u.profiles[0]?.avatar_url : u.profiles?.avatar_url,
          faculty: Array.isArray(u.profiles) ? u.profiles[0]?.faculty : u.profiles?.faculty,
          diagnosis: diagnosis, 
          lastSession: sessionData.lastSession,
          nextSession: sessionData.nextSession,
          state: "active",
          riskLevel: "low",
          assignedId: assignedId || null,
          isAssigned: assignedId != null
        };
      });

      this.allPatients = [...this.patientsData];
    } else {
      this.patientsData = [];
      this.allPatients = [];
    }
  }

  async assignPatientBase(patientId: string) {
    if (!this.currentUserId) return;

    const { data: record } = await this.supabase
      .from('student_clinical_records')
      .select('id')
      .eq('student_id', patientId)
      .maybeSingle();

    const updatePayload: any = this.isNutritionist 
      ? { primary_nutritionist_id: this.currentUserId }
      : { primary_psychologist_id: this.currentUserId };

    let error = null;
    if (record) {
      const res = await this.supabase
        .from('student_clinical_records')
        .update(updatePayload)
        .eq('student_id', patientId);
      error = res.error;
    } else {
      const insertPayload: any = { student_id: patientId, ...updatePayload };
      const res = await this.supabase
        .from('student_clinical_records')
        .insert(insertPayload);
      error = res.error;
    }

    if (!error) {
      this.showGlobalModal = false;
      await this.loadPatientsBase();
    } else {
      console.error('Error asignando paciente:', error.message);
    }
  }

  viewProfileBase(patientId: string) {
    const currentUrl = (this.router.url || '').toLowerCase();
    const routePrefix = currentUrl.includes('/nutritionist')
      ? '/nutritionist/pacientes'
      : '/psychologist/patients';
    this.router.navigate([routePrefix, patientId]);
  }
}
