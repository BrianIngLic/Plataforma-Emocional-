import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './patients.component.html',
  styleUrls: ['./patients.component.scss']
})
export class PatientsComponent implements OnInit {
  searchTerm: string = '';
  globalSearchTerm: string = '';
  showGlobalModal = false;
  supabase = inject(SupabaseService).supabase;
  authService = inject(AuthService);
  patientsData: any[] = [];
  
  get currentUserId() { return this.authService.currentUser()?.id; }

  mockPatientsData = [
    { id: "1", firstName: "Elena", lastName: "Marchetti", diagnosis: "Trastorno de Ansiedad Generalizada", lastSession: "2026-06-15", state: "active", riskLevel: "low" },
    { id: "2", firstName: "David", lastName: "Okafor", diagnosis: "Trastorno Depresivo Mayor", lastSession: "2026-06-14", state: "active", riskLevel: "moderate" },
    { id: "3", firstName: "Sara", lastName: "Lindqvist", diagnosis: "Depresión + Ideación Suicida", lastSession: "2026-06-16", state: "critical", riskLevel: "high" },
    { id: "4", firstName: "Tomás", lastName: "Ruiz", diagnosis: "Ansiedad Social", lastSession: "2026-06-13", state: "active", riskLevel: "low" },
    { id: "5", firstName: "Amina", lastName: "Hassan", diagnosis: "TEPT", lastSession: "2026-06-12", state: "active", riskLevel: "moderate" },
    { id: "6", firstName: "Kenji", lastName: "Watanabe", diagnosis: "Ataques de Pánico", lastSession: "2026-06-10", state: "inactive", riskLevel: "low" },
    { id: "7", firstName: "Yusuf", lastName: "Al-Amin", diagnosis: "Trastorno Bipolar I", lastSession: "2026-06-15", state: "critical", riskLevel: "high" },
    { id: "8", firstName: "Carla", lastName: "Dominguez", diagnosis: "TEPT (Agudo)", lastSession: "2026-06-13", state: "active", riskLevel: "moderate" },
    { id: "9", firstName: "Lena", lastName: "Braun", diagnosis: "Trastorno Depresivo Mayor", lastSession: "2026-06-15", state: "active", riskLevel: "moderate" },
    { id: "10", firstName: "Marco", lastName: "Ferretti", diagnosis: "Ansiedad Generalizada", lastSession: "2026-06-05", state: "inactive", riskLevel: "moderate" }
  ];

  constructor(private router: Router) {}

  async ngOnInit() {
    await this.loadPatients();
  }

  async loadPatients() {
    // Intentar traer de la base de datos real
    const { data, error } = await this.supabase
      .from('users')
      .select('id, matricula, profiles(first_name, last_name), student_clinical_records!student_clinical_records_student_id_fkey(known_conditions, primary_psychologist_id)')
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
        const assignedId = recordObj?.primary_psychologist_id || null;

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
    const global = this.patientsData.filter(p => p.assignedId !== this.currentUserId);
    return global.filter(p => 
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(term) ||
      (p.matricula && p.matricula.toLowerCase().includes(term))
    );
  }

  async assignPatient(studentId: string) {
    if (!this.currentUserId) return;
    
    const { data: record } = await this.supabase
      .from('student_clinical_records')
      .select('id')
      .eq('student_id', studentId)
      .single();

    if (record) {
      await this.supabase
        .from('student_clinical_records')
        .update({ primary_psychologist_id: this.currentUserId })
        .eq('student_id', studentId);
    } else {
      await this.supabase
        .from('student_clinical_records')
        .insert({ student_id: studentId, primary_psychologist_id: this.currentUserId });
    }

    await this.loadPatients();
    this.showGlobalModal = false;
  }

  viewProfile(id: string) {
    this.router.navigate(['/psychologist/patients', id]);
  }
}
