import { Component } from '@angular/core';
import { OnInit, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';


@Component({
  selector: 'app-pacientes',
  standalone: true,
  imports: [CommonModule,FormsModule, MatIconModule],
  templateUrl: './pacientes.html',
  styleUrl: './pacientes.scss',
})
export class Pacientes implements OnInit{
  searchTerm: string = '';
  globalSearchTerm: string = '';
  showGlobalModal = false;
  supabase = inject(SupabaseService).supabase;
  authService = inject(AuthService);
  patientsData: any[] = [];
  allPatients: any[] = [];
  
  get currentUserId() { return this.authService.currentUser()?.id; }

  constructor(private router: Router) {}

  async ngOnInit() {
    await this.loadPatients();
    await this.loadAllPatients();
  }

  async loadPatients() {
    // Intentar traer de la base de datos real
    const { data, error } = await this.supabase
      .from('users')
      .select('id, matricula, profiles(first_name, last_name), student_clinical_records!student_clinical_records_student_id_fkey(known_conditions, primary_nutritionist_id)')
      .eq('role_id', 2);
      
    console.log('--- DEBUG loadPatients ---');
    console.log('Data cruda Supabase:', data);
    console.log('Error Supabase:', error);
    console.log('Rol del usuario actual (ID):', this.currentUserId);
    
    if (error) {
      console.error('Error cargando pacientes:', error.message);
      this.patientsData = [];
      return;
    }

    if (data) {
      this.patientsData = data.map((u: any) => {
        const records = u.student_clinical_records;
        const recordObj = Array.isArray(records) ? records[0] : records;
        const conditions = recordObj?.known_conditions;
        const diagnosis = conditions && conditions.length > 0 ? conditions.join(', ') : "Evaluación Pendiente";
        const assignedId = recordObj?.primary_nutritionist_id || null;

        return {
          id: u.id,
          matricula: u.matricula,
          firstName: Array.isArray(u.profiles) ? u.profiles[0]?.first_name : u.profiles?.first_name,
          lastName: Array.isArray(u.profiles) ? u.profiles[0]?.last_name : u.profiles?.last_name,
          diagnosis: diagnosis, 
          lastSession: new Date().toISOString().split('T')[0],
          nextSession: "Por agendar",
          state: "active",
          riskLevel: "low",
          assignedId: assignedId
        };
      });
    } else {
      this.patientsData = [];
    }
  }

  async loadAllPatients() {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, matricula, profiles(first_name, last_name), student_clinical_records!student_clinical_records_student_id_fkey(primary_nutritionist_id)')
      .eq('role_id', 2);

    if (!error && data) {
      this.allPatients = data.map((u: any) => {
        const records = u.student_clinical_records;
        const recordObj = Array.isArray(records) ? records[0] : records;
        const assignedId = recordObj?.primary_nutritionist_id;

        return {
          id: u.id,
          matricula: u.matricula,
          firstName: Array.isArray(u.profiles) ? u.profiles[0]?.first_name : u.profiles?.first_name,
          lastName: Array.isArray(u.profiles) ? u.profiles[0]?.last_name : u.profiles?.last_name,
          assignedId: assignedId,
          isAssigned: assignedId !== null
        };
      });
    }
  }

  get myPatients() {
    return this.patientsData.filter(p => p.assignedId === this.currentUserId);
  }

  get filteredPatients() {
    const term = this.searchTerm.toLowerCase();
    return this.myPatients.filter(p => 
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(term) ||
      p.diagnosis.toLowerCase().includes(term)
    );
  }

  get filteredGlobalPatients() {
    const term = this.globalSearchTerm.toLowerCase();
    return this.allPatients.filter(p => 
      !p.isAssigned && (
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(term) ||
        p.matricula.toLowerCase().includes(term)
      )
    );
  }

  async assignPatient(patientId: string) {
    if (!this.currentUserId) return;

    const { data: record } = await this.supabase
      .from('student_clinical_records')
      .select('id')
      .eq('student_id', patientId)
      .single();

    let error = null;
    if (record) {
      const res = await this.supabase
        .from('student_clinical_records')
        .update({ primary_nutritionist_id: this.currentUserId })
        .eq('student_id', patientId);
      error = res.error;
    } else {
      const res = await this.supabase
        .from('student_clinical_records')
        .insert({ student_id: patientId, primary_nutritionist_id: this.currentUserId });
      error = res.error;
    }

    if (!error) {
      this.showGlobalModal = false;
      await this.loadPatients();
      await this.loadAllPatients();
    }
  }

  viewProfile(patientId: string) {
    this.router.navigate(['/nutritionist/pacientes', patientId]);
  }
}
