import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { EmojiScaleComponent } from './emoji-scale/emoji-scale.component';
import { SessionEvaluationService } from '../../../core/services/session-evaluation.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-session-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, EmojiScaleComponent],
  templateUrl: './session-feedback.component.html',
  styleUrls: ['./session-feedback.component.scss']
})
export class SessionFeedbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private evaluationService = inject(SessionEvaluationService);
  private authService = inject(AuthService);
  private supabaseService = inject(SupabaseService);

  appointmentId: string | null = null;
  professionalId: string | null = null;
  professionalName: string = 'tu especialista';

  isLoading = signal<boolean>(true);
  isSubmitting = signal<boolean>(false);
  alreadyAnswered = signal<boolean>(false);
  currentStep = signal<number>(0); // 0-3: emoji questions, 4: comment, 5: success page

  answers = {
    q1: 0,
    q2: 0,
    q3: 0,
    q4: 0,
    q5: ''
  };

  questions = [
    { question: '¿Cómo calificas la sesión de hoy en general?' },
    { question: '¿Cómo sentiste el apoyo, la escucha y la empatía de tu especialista hoy?' },
    { question: '¿Hablamos y trabajamos en lo que tú querías y necesitabas tratar hoy?' },
    { question: 'Al terminar hoy, ¿te sientes con mayor claridad, esperanza o herramientas para afrontar tus retos?' }
  ];

  async ngOnInit() {
    this.appointmentId = this.route.snapshot.paramMap.get('appointmentId');
    if (!this.appointmentId) {
      this.router.navigate(['/dashboard']);
      return;
    }

    try {
      // 1. Verificar si ya fue evaluada
      const existing = await this.evaluationService.getEvaluationByAppointment(this.appointmentId);
      if (existing) {
        this.alreadyAnswered.set(true);
        this.isLoading.set(false);
        return;
      }

      // 2. Obtener detalles de la cita para professionalId y professionalName
      const { data: appointment, error } = await this.supabaseService.supabase
        .from('appointments')
        .select('professional_id, profiles:professional_id(full_name)')
        .eq('id', this.appointmentId)
        .single();

      if (error || !appointment) {
        console.error('Error cargando cita:', error);
        this.router.navigate(['/dashboard']);
        return;
      }

      this.professionalId = appointment.professional_id;
      this.professionalName = (appointment.profiles as any)?.full_name || 'tu especialista';
      this.isLoading.set(false);
    } catch (err) {
      console.error('Error en onboarding de feedback:', err);
      this.router.navigate(['/dashboard']);
    }
  }

  handleScore(score: number) {
    const step = this.currentStep();
    if (step === 0) this.answers.q1 = score;
    else if (step === 1) this.answers.q2 = score;
    else if (step === 2) this.answers.q3 = score;
    else if (step === 3) this.answers.q4 = score;

    this.currentStep.set(step + 1);
  }

  async submitFeedback() {
    if (this.isSubmitting() || !this.appointmentId || !this.professionalId) return;

    const patientId = this.authService.currentUser()?.id;
    if (!patientId) return;

    this.isSubmitting.set(true);

    try {
      await this.evaluationService.submitEvaluation({
        appointmentId: this.appointmentId,
        patientId: patientId,
        professionalId: this.professionalId,
        q1Global: this.answers.q1,
        q2Bond: this.answers.q2,
        q3Goals: this.answers.q3,
        q4Impact: this.answers.q4,
        q5Comment: this.answers.q5.trim() || undefined
      });

      // Actualizar el conteo global de pendientes
      await this.evaluationService.getPendingEvaluations(patientId);

      this.currentStep.set(5); // Ir a pantalla de cierre
    } catch (err) {
      console.error('Error enviando retroalimentación:', err);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  goBack() {
    const step = this.currentStep();
    if (step > 0 && step < 5) {
      this.currentStep.set(step - 1);
    }
  }

  finish() {
    this.router.navigate(['/dashboard']);
  }
}
