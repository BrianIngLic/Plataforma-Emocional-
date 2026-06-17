import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './patients.component.html',
  styleUrls: ['./patients.component.scss']
})
export class PatientsComponent {
  searchTerm: string = '';

  patientsData = [
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

  get filteredPatients() {
    const term = this.searchTerm.toLowerCase();
    return this.patientsData.filter(p => 
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(term) ||
      p.diagnosis.toLowerCase().includes(term)
    );
  }

  viewProfile(id: string) {
    this.router.navigate(['/psychologist/patients', id]);
  }
}
