import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HealthProfessionalBase } from '../../../core/base/health-professional.base';

@Component({
  selector: 'app-health-professional-patients',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './patients.component.html',
  styleUrls: ['./patients.component.scss']
})
export class HealthProfessionalPatientsComponent extends HealthProfessionalBase implements OnInit {
  async ngOnInit() {
    await this.loadPatientsBase();
  }

  async assignPatient(patientId: string) {
    await this.assignPatientBase(patientId);
  }

  viewProfile(patientId: string) {
    this.viewProfileBase(patientId);
  }
}
