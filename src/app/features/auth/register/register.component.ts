import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

// Angular Material Imports
import { MatStepperModule } from '@angular/material/stepper';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { AuthService } from '../../../core/services/auth.service';
import { ClinicalService } from '../../../core/services/clinical.service';
import { FacultyService, Faculty } from '../../../core/services/faculty.service';

/**
 * Componente de Registro (Standalone)
 * Implementa el Onboarding Clínico usando MatStepper.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    RouterLink,
    MatStepperModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatRadioModule,
    MatAutocompleteModule
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private clinicalService = inject(ClinicalService);
  private facultyService = inject(FacultyService);
  private router = inject(Router);

  faculties: Faculty[] = [];
  filteredFaculties: Faculty[] = [];

  // Paso 1: Credenciales
  credentialsFormGroup = this.fb.group({
    matricula: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // Paso 2: Datos Personales
  profileFormGroup = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    faculty: ['', Validators.required],
    programaEducativo: ['', Validators.required],
    celular: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
    antecedentesFamiliares: ['', Validators.required],
    sexo: ['', Validators.required],
    fechaNacimiento: ['', Validators.required]
  });

  // Paso 3: Consentimiento
  consentFormGroup = this.fb.group({
    acceptedTerms: [false, Validators.requiredTrue]
  });

  isSubmitting = false;

  showPrivacyModal = false;

  openPrivacyModal(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.showPrivacyModal = true;
  }

  closePrivacyModal() {
    this.showPrivacyModal = false;
  }

  async ngOnInit() {
    this.faculties = await this.facultyService.getFaculties();
    this.filteredFaculties = this.faculties;

    // Escuchar cambios para el buscador
    this.profileFormGroup.get('faculty')?.valueChanges.subscribe(value => {
      this.filterFaculties(value || '');
    });
  }

  filterFaculties(value: string) {
    const filterValue = value.toLowerCase();
    this.filteredFaculties = this.faculties.filter(f => f.name.toLowerCase().includes(filterValue));
  }

  calculateAge(birthDateString: string): number {
    if (!birthDateString) return 0;
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  async submitRegistration() {
    if (this.credentialsFormGroup.invalid || this.profileFormGroup.invalid || this.consentFormGroup.invalid) {
      this.credentialsFormGroup.markAllAsTouched();
      this.profileFormGroup.markAllAsTouched();
      this.consentFormGroup.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const matricula = this.credentialsFormGroup.value.matricula!;
    const email = this.credentialsFormGroup.value.email!;
    const password = this.credentialsFormGroup.value.password!;
    const firstName = this.profileFormGroup.value.firstName!;
    const lastName = this.profileFormGroup.value.lastName!;
    const faculty = this.profileFormGroup.value.faculty!;
    
    // Auth Service enviando faculty
    const userId = await this.authService.register(matricula, email, password, firstName, lastName, faculty);

    if (userId) {
      // Crear expediente clínico inicial con los datos generales del estudiante
      const generalData = {
        nombre: `${firstName} ${lastName}`,
        unidad_academica: faculty,
        programa_educativo: this.profileFormGroup.value.programaEducativo || '',
        celular: this.profileFormGroup.value.celular || '',
        correo: email,
        antecedentes_familiares: this.profileFormGroup.value.antecedentesFamiliares || '',
        sexo: this.profileFormGroup.value.sexo || '',
        fecha_nacimiento: this.profileFormGroup.value.fechaNacimiento || '',
        edad: this.profileFormGroup.value.fechaNacimiento ? this.calculateAge(this.profileFormGroup.value.fechaNacimiento) : 0
      };

      const initialClinicalData = {
        general_data: generalData
      };
      
      const conditions = [JSON.stringify(initialClinicalData)]; 
      
      const success = await this.clinicalService.submitClinicalRecords(matricula, conditions, true);
      this.isSubmitting = false;
      if (success) {
        this.router.navigate(['/']); 
      }
    } else {
      this.isSubmitting = false;
      console.error("Error al registrar el usuario");
    }
  }
}
