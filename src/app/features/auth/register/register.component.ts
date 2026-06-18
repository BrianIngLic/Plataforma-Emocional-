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

  // Opciones de respuesta EAT-26
  eatOptions = ['Siempre', 'Casi siempre', 'A menudo', 'A veces', 'Rara vez', 'Nunca'];
  behavioralOptions = ['Nunca', '1 vez al mes o menos', '2-3 veces al mes', '1 vez a la semana', '2-6 veces por semana', '1 vez al día o más'];

  // Preguntas Parte B
  partBQuestions = [
    { id: 'q1', text: '1. Me aterroriza la idea de tener sobrepeso.' },
    { id: 'q2', text: '2. Evito comer cuando tengo hambre.' },
    { id: 'q3', text: '3. Me doy cuenta de que estoy muy preocupado(a) por la comida.' },
    { id: 'q4', text: '4. He tenido atracones en los que siento que no puedo parar.' },
    { id: 'q5', text: '5. Corto mi comida en trozos muy pequeños.' },
    { id: 'q6', text: '6. Soy consciente del contenido calórico de lo que como.' },
    { id: 'q7', text: '7. Evito alimentos con alto contenido de carbohidratos.' },
    { id: 'q8', text: '8. Siento que los demás preferirían que comiera más.' },
    { id: 'q9', text: '9. Vomito después de haber comido.' },
    { id: 'q10', text: '10. Me siento extremadamente culpable después de comer.' },
    { id: 'q11', text: '11. Estoy preocupado(a) por el deseo de ser más delgado(a).' },
    { id: 'q12', text: '12. Pienso en quemar calorías cuando hago ejercicio.' },
    { id: 'q13', text: '13. Otras personas piensan que estoy demasiado delgado(a).' },
    { id: 'q14', text: '14. Me preocupa la idea de tener grasa en mi cuerpo.' },
    { id: 'q15', text: '15. Tardo más que los demás en comer mis comidas.' },
    { id: 'q16', text: '16. Evito los alimentos con azúcar.' },
    { id: 'q17', text: '17. Consumo alimentos dietéticos.' },
    { id: 'q18', text: '18. Siento que la comida controla mi vida.' },
    { id: 'q19', text: '19. Muestro autocontrol en torno a la comida.' },
    { id: 'q20', text: '20. Siento que los demás me presionan para comer.' },
    { id: 'q21', text: '21. Dedico demasiado tiempo y pensamientos a la comida.' },
    { id: 'q22', text: '22. Me siento incómodo(a) después de comer dulces.' },
    { id: 'q23', text: '23. Me involucro en conductas de dieta.' },
    { id: 'q24', text: '24. Me gusta que mi estómago esté vacío.' },
    { id: 'q25', text: '25. Tengo el impulso de vomitar después de las comidas.' },
    { id: 'q26', text: '26. Disfruto probar alimentos nuevos y ricos.' }
  ];

  // Preguntas Parte C
  partCQuestions = [
    { id: 'bA', text: 'A. ¿Te has dado atracones en los que sientes que no puedes parar?' },
    { id: 'bB', text: 'B. ¿Te has provocado el vómito para controlar tu peso o forma?' },
    { id: 'bC', text: 'C. ¿Has usado laxantes, pastillas para adelgazar o diuréticos?' },
    { id: 'bD', text: 'D. ¿Has hecho ejercicio más de 60 minutos al día para perder peso?' },
  ];

  // Paso 3 y 4: Cuestionario Clínico (EAT-26) Dividido
  clinicalPart1FormGroup: FormGroup;
  clinicalPart2FormGroup: FormGroup;

  constructor() {
    // Inicializar el Form Group de la Parte 1
    const group1: any = {};
    this.partBQuestions.forEach(q => {
      group1[q.id] = ['', Validators.required];
    });
    this.clinicalPart1FormGroup = this.fb.group(group1);

    // Inicializar el Form Group de la Parte 2
    const group2: any = {};
    this.partCQuestions.forEach(q => {
      group2[q.id] = ['', Validators.required];
    });
    group2['bE'] = ['', Validators.required];
    this.clinicalPart2FormGroup = this.fb.group(group2);
  }

  // Paso 4: Consentimiento
  consentFormGroup = this.fb.group({
    acceptedTerms: [false, Validators.requiredTrue]
  });

  isSubmitting = false;

  async submitRegistration() {
    console.log(this.credentialsFormGroup.value);
    if (this.consentFormGroup.invalid || this.clinicalPart1FormGroup.invalid || this.clinicalPart2FormGroup.invalid) {
      this.clinicalPart1FormGroup.markAllAsTouched();
      this.clinicalPart2FormGroup.markAllAsTouched();
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
      // Extraemos todo el payload del test EAT-26 uniendo ambas partes
      const clinicalData = {
        ...this.clinicalPart1FormGroup.value,
        ...this.clinicalPart2FormGroup.value
      };
      const conditions = [JSON.stringify(clinicalData)]; 
      
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
