import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

// Angular Material Imports
import { MatStepperModule } from '@angular/material/stepper';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';

import { AuthService } from '../../../core/services/auth.service';
import { ClinicalService } from '../../../core/services/clinical.service';

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
    MatRadioModule
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private clinicalService = inject(ClinicalService);
  private router = inject(Router);

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
  });

  // Paso 3: Consentimiento
  consentFormGroup = this.fb.group({
    acceptedTerms: [false, Validators.requiredTrue]
  });

  isSubmitting = false;

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
    
    const userId = await this.authService.register(matricula, email, password, firstName, lastName);

    if (userId) {
      // Crear un expediente clínico en blanco por defecto
      const emptyClinicalData = {};
      const conditions = [JSON.stringify(emptyClinicalData)]; 
      
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
