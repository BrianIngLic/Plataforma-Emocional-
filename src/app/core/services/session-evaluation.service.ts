import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

// Payload que el paciente envía al completar el formulario de evaluación
export interface SessionEvaluationPayload {
  appointmentId: string;
  patientId: string;
  professionalId: string;
  q1Global: number;  // 1.0 – 5.0
  q2Bond: number;
  q3Goals: number;
  q4Impact: number;
  q5Comment?: string;
}

// Registro persistido en session_evaluations
export interface SessionEvaluation {
  id: string;
  appointmentId: string;
  patientId: string;
  professionalId: string;
  q1Global: number;
  q2Bond: number;
  q3Goals: number;
  q4Impact: number;
  q5Comment?: string;
  scoreGlobal: number;
  ruptureFlag: 'critical' | 'decline' | 'healthy' | 'pending';
  createdAt: string;
}

// Cita completada que aún no tiene evaluación asociada
export interface PendingEvaluationItem {
  appointmentId: string;
  professionalName: string;
  date: string;
}

// Proyección ligera para el dashboard del profesional
export interface ProfessionalEvaluationSummary {
  scoreGlobal: number;
  ruptureFlag: string;
  createdAt: string;
  patientId: string;
}

@Injectable({
  providedIn: 'root'
})
export class SessionEvaluationService {
  private supabase = inject(SupabaseService).supabase;

  // Conteo de evaluaciones pendientes; expuesto como writable para que el
  // componente contenedor pueda actualizarlo tras cargar getPendingEvaluations()
  public pendingEvaluationsCount = signal<number>(0);

  // --- Utilidades privadas de cálculo ---

  /** Pondera las cuatro dimensiones con sus pesos clínicos definidos. */
  private calculateScoreGlobal(q1: number, q2: number, q3: number, q4: number): number {
    return Math.round((q1 * 0.20 + q2 * 0.30 + q3 * 0.25 + q4 * 0.25) * 10) / 10;
  }

  /**
   * Clasifica la ruptura terapéutica:
   * - 'critical'  → algún ítem ≤ 2.0 O scoreGlobal < 3.5
   * - 'healthy'   → scoreGlobal ≥ 4.0 Y todos los ítems ≥ 3.0
   * - 'decline'   → cualquier caso intermedio
   */
  private calculateRuptureFlag(
    q1: number, q2: number, q3: number, q4: number, scoreGlobal: number
  ): 'critical' | 'decline' | 'healthy' {
    const anyCriticalItem = [q1, q2, q3, q4].some(q => q <= 2.0);
    if (anyCriticalItem || scoreGlobal < 3.5) return 'critical';
    if (scoreGlobal >= 4.0 && [q1, q2, q3, q4].every(q => q >= 3.0)) return 'healthy';
    return 'decline';
  }

  /** Mapea una fila snake_case de Supabase al tipo SessionEvaluation camelCase. */
  private mapRow(row: Record<string, any>): SessionEvaluation {
    return {
      id:             row['id'],
      appointmentId:  row['appointment_id'],
      patientId:      row['patient_id'],
      professionalId: row['professional_id'],
      q1Global:       row['q1_global'],
      q2Bond:         row['q2_bond'],
      q3Goals:        row['q3_goals'],
      q4Impact:       row['q4_impact'],
      q5Comment:      row['q5_comment'] ?? undefined,
      scoreGlobal:    row['score_global'],
      ruptureFlag:    row['rupture_flag'],
      createdAt:      row['created_at'],
    };
  }

  // --- Métodos públicos ---

  /**
   * Persiste una evaluación de sesión.
   * scoreGlobal y ruptureFlag se calculan en el cliente antes del INSERT
   * para evitar dependencia de funciones RPC en la base de datos.
   */
  async submitEvaluation(payload: SessionEvaluationPayload): Promise<SessionEvaluation> {
    const { q1Global, q2Bond, q3Goals, q4Impact } = payload;

    const scoreGlobal = this.calculateScoreGlobal(q1Global, q2Bond, q3Goals, q4Impact);
    const ruptureFlag = this.calculateRuptureFlag(q1Global, q2Bond, q3Goals, q4Impact, scoreGlobal);

    const { data, error } = await this.supabase
      .from('session_evaluations')
      .insert({
        appointment_id:  payload.appointmentId,
        patient_id:      payload.patientId,
        professional_id: payload.professionalId,
        q1_global:       q1Global,
        q2_bond:         q2Bond,
        q3_goals:        q3Goals,
        q4_impact:       q4Impact,
        q5_comment:      payload.q5Comment ?? null,
        score_global:    scoreGlobal,
        rupture_flag:    ruptureFlag,
      })
      .select()
      .single();

    if (error) {
      console.error('SessionEvaluationService.submitEvaluation:', error);
      throw error;
    }

    return this.mapRow(data as Record<string, any>);
  }

  /**
   * Recupera la evaluación vinculada a una cita específica.
   * Retorna null cuando la cita aún no ha sido evaluada, lo que permite
   * mostrar u ocultar el formulario de evaluación en la UI.
   */
  async getEvaluationByAppointment(appointmentId: string): Promise<SessionEvaluation | null> {
    const { data, error } = await this.supabase
      .from('session_evaluations')
      .select('*')
      .eq('appointment_id', appointmentId)
      .maybeSingle();

    if (error) {
      console.error('SessionEvaluationService.getEvaluationByAppointment:', error);
      throw error;
    }

    return data ? this.mapRow(data as Record<string, any>) : null;
  }

  /**
   * Devuelve las citas completadas del paciente que todavía no tienen evaluación.
   * Se implementa con dos queries independientes en lugar de un JOIN para
   * compatibilidad con las políticas RLS de Supabase que bloquean joins cruzados.
   *
   * Paso 1 → appointments completadas del paciente (incluye datos del profesional)
   * Paso 2 → filtra las que YA tienen evaluación usando los IDs del paso 1
   */
  async getPendingEvaluations(patientId: string): Promise<PendingEvaluationItem[]> {
    // Paso 1: citas completadas del paciente con nombre del profesional
    const { data: appointments, error: apptError } = await this.supabase
      .from('appointments')
      .select('id, scheduled_date, professional_id, profiles:professional_id(full_name)')
      .eq('student_id', patientId)
      .eq('status', 'completed');

    if (apptError) {
      console.error('SessionEvaluationService.getPendingEvaluations [appointments]:', apptError);
      throw apptError;
    }

    if (!appointments || appointments.length === 0) return [];

    const appointmentIds = appointments.map((a: any) => a.id as string);

    // Paso 2: evaluaciones ya existentes para estas citas
    const { data: evaluations, error: evalError } = await this.supabase
      .from('session_evaluations')
      .select('appointment_id')
      .in('appointment_id', appointmentIds);

    if (evalError) {
      console.error('SessionEvaluationService.getPendingEvaluations [evaluations]:', evalError);
      throw evalError;
    }

    const evaluatedIds = new Set((evaluations ?? []).map((e: any) => e.appointment_id as string));

    // Filtra las citas que no tienen evaluación aún
    const pending = appointments
      .filter((a: any) => !evaluatedIds.has(a.id))
      .map((a: any) => ({
        appointmentId:    a.id as string,
        professionalName: (a.profiles as any)?.full_name ?? 'Profesional',
        date:             a.scheduled_date as string,
      }));

    // Mantiene el Signal sincronizado tras cada consulta
    this.pendingEvaluationsCount.set(pending.length);

    return pending;
  }

  /**
   * Lista todas las evaluaciones recibidas por un profesional,
   * ordenadas de más reciente a más antigua para facilitar revisión clínica.
   */
  async getEvaluationsByProfessional(professionalId: string): Promise<ProfessionalEvaluationSummary[]> {
    const { data, error } = await this.supabase
      .from('session_evaluations')
      .select('score_global, rupture_flag, created_at, patient_id')
      .eq('professional_id', professionalId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('SessionEvaluationService.getEvaluationsByProfessional:', error);
      throw error;
    }

    return (data ?? []).map((row: any) => ({
      scoreGlobal: row.score_global as number,
      ruptureFlag: row.rupture_flag as string,
      createdAt:   row.created_at as string,
      patientId:   row.patient_id as string,
    }));
  }

  /**
   * Calcula la media de score_global para un profesional.
   * Retorna 0 cuando no existen evaluaciones para evitar divisiones por cero.
   */
  async getAverageScoreForProfessional(professionalId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('session_evaluations')
      .select('score_global')
      .eq('professional_id', professionalId);

    if (error) {
      console.error('SessionEvaluationService.getAverageScoreForProfessional:', error);
      throw error;
    }

    if (!data || data.length === 0) return 0;

    const sum = (data as any[]).reduce((acc, row) => acc + (row.score_global as number), 0);
    return Math.round((sum / data.length) * 10) / 10;
  }
}
