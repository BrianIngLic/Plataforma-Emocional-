import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { DossierExportService } from '../../../core/services/dossier-export.service';
import { GamificationService } from '../../../core/services/gamification.service';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

@Component({
  selector: 'app-patient-profile',
  standalone: true,
  imports: [CommonModule, MatIconModule, BaseChartDirective, FormsModule],
  templateUrl: './patient-profile.component.html',
  styleUrls: ['./patient-profile.component.scss']
})
export class PatientProfileComponent implements OnInit {
  supabase = inject(SupabaseService).supabase;
  crypto = inject(CryptoService);
  dialog = inject(MatDialog);
  dossierExport = inject(DossierExportService);
  gamificationService = inject(GamificationService);

  patient: any = null;
  diaryEntries: any[] = [];
  loading = true;
  isExporting = false;

  // Datos de Gamificación del Paciente
  patientStreak: any = { current_streak: 0, best_streak: 0, total_xp: 0 };
  patientAchievements: any[] = [];

  // Formulario de Logro Clínico Manual
  newAchTitle = '';
  newAchDesc = '';
  newAchPoints = 100;
  newAchIcon = 'verified';
  newAchNotes = '';
  isAssigningAchievement = false;

  sessionHistory: any[] = [];

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'],
    datasets: [
      {
        data: [18, 16, 15, 14, 12, 11, 10, 9],
        label: 'Puntuación PHQ-9',
        borderColor: '#1a56db',
        backgroundColor: 'rgba(26, 86, 219, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, min: 0, max: 27 }
    }
  };

  allianceStatus: 'critical' | 'decline' | 'healthy' | null = null;
  allianceDeclineAlert = false;
  allianceDeclineValue = 0;

  public allianceChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Alianza (FIT/SRS)',
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  public allianceChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, min: 1.0, max: 5.0 }
    }
  };

  // Variables del Calendario
  currentDate = new Date();
  monthName = '';
  year = 0;
  calendarDays: number[] = [];
  blankDays: number[] = [];
  selectedDate: number | null = null;
  
  calendarMode: 'days' | 'months' = 'days';
  monthsList = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  eat26Result: any = null;

  constructor(private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadPatientData(id);
    } else {
      this.goBack();
    }
  }

  calculateEat26Score(parsedNotes: any): any {
    let score = 0;
    let hasBehavioralRisk = false;

    const scoreMapNormal: any = { 'Siempre': 3, 'Casi siempre': 2, 'A menudo': 1, 'A veces': 0, 'Rara vez': 0, 'Nunca': 0 };
    const scoreMapQ26: any = { 'Siempre': 0, 'Casi siempre': 0, 'A menudo': 0, 'A veces': 1, 'Rara vez': 2, 'Nunca': 3 };

    for (let i = 1; i <= 26; i++) {
      const ans = parsedNotes['q' + i];
      if (ans) {
        if (i === 26) {
          score += scoreMapQ26[ans] || 0;
        } else {
          score += scoreMapNormal[ans] || 0;
        }
      }
    }

    const behavioralIds = ['bA', 'bB', 'bC', 'bD'];
    behavioralIds.forEach(id => {
       const ans = parsedNotes[id];
       if (ans && ans !== 'Nunca' && ans !== 'No') {
          hasBehavioralRisk = true;
       }
    });
    
    if (parsedNotes['bE'] === 'Sí') {
       hasBehavioralRisk = true;
    }

    const hasRisk = score >= 20 || hasBehavioralRisk;
    
    let interpretation = hasRisk 
      ? 'Riesgo de Trastorno de Conducta Alimentaria (TCA). Se recomienda evaluación diagnóstica especializada.'
      : 'Sin evidencia numérica de riesgo alto, sin embargo, el juicio clínico prevalece.';

    return {
      score,
      hasRisk,
      behavioralRisk: hasBehavioralRisk,
      interpretation
    };
  }

  async loadPatientData(id: string) {
    this.loading = true;
    
    try {
      // 1. Fetch user + profile + clinical record
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('id, profiles(first_name, last_name, avatar_url), student_clinical_records!student_clinical_records_student_id_fkey(known_conditions, additional_notes)')
        .eq('id', id)
        .single();

      if (userError) {
        console.error('Error fetching patient data:', userError);
      }

      if (userData) {
        const p = Array.isArray(userData.profiles) ? userData.profiles[0] : userData.profiles;
        const records = userData.student_clinical_records;
        const recordObj = Array.isArray(records) ? records[0] : records;
        
        const conditions = recordObj?.known_conditions;
        let notes = recordObj?.additional_notes;

        if (notes) {
          try {
            const decrypted = this.crypto.decrypt(notes);
            const parsedNotes = JSON.parse(decrypted);
            if (parsedNotes.q1) {
                this.eat26Result = this.calculateEat26Score(parsedNotes);
            }
            notes = decrypted;
          } catch(e) {
            console.warn('Error al descifrar o parsear notas, se asume texto plano:', e);
          }
        } else {
          notes = "Sin notas clínicas adicionales guardadas en el expediente.";
        }

        this.patient = {
          id: userData.id,
          firstName: p?.first_name || 'Paciente',
          lastName: p?.last_name || 'Sin Nombre',
          avatarUrl: p?.avatar_url || '',
          age: 22,
          gender: "Estudiante BUAP",
          diagnosis: conditions && conditions.length > 0 ? conditions.join(' + ') : "Evaluación Pendiente",
          treatmentPlan: "TCC + Monitoreo con Amati",
          medications: ["Ninguno registrado"],
          sessionCount: 0,
          nextSession: "Por agendar",
          state: (this.eat26Result && this.eat26Result.hasRisk) ? "Critical" : "Active",
          riskLevel: (this.eat26Result && this.eat26Result.hasRisk) ? "Alto" : (conditions && conditions.length > 0 ? "Moderado" : "Bajo"),
          notes: notes
        };
      }

      // 2. Fetch diary entries
      const { data: diaryData, error: diaryError } = await this.supabase
        .from('diary_entries')
        .select('id, content, moods, high_risk, created_at')
        .eq('student_id', id)
        .order('created_at', { ascending: false });
        
      if (diaryError) {
        console.error('Error fetching diary entries:', diaryError);
      }

      if (diaryData) {
        this.diaryEntries = diaryData.map((entry: any) => {
          let decryptedContent = '';
          try {
            decryptedContent = this.crypto.decrypt(entry.content);
          } catch(e) {
            decryptedContent = entry.content; // fallback si no está cifrado
          }
          return {
            rawDate: new Date(entry.created_at),
            date: new Date(entry.created_at).toLocaleDateString() + ' ' + new Date(entry.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            mood: entry.moods && entry.moods.length > 0 ? entry.moods.join(', ') : 'Neutro',
            moodColor: entry.high_risk ? 'text-red' : 'text-primary',
            moodIcon: entry.high_risk ? 'warning' : 'sentiment_satisfied',
            content: decryptedContent
          };
        });
      }
      // 3. Fetch session history
      const { data: appts } = await this.supabase
        .from('appointments')
        .select('*')
        .eq('student_id', id)
        .order('scheduled_date', { ascending: false })
        .order('start_time', { ascending: false });

      if (appts) {
        this.sessionHistory = appts.map(a => {
          const d = new Date(a.scheduled_date.substring(0, 10) + 'T12:00:00');
          const day = d.getDate().toString().padStart(2, '0');
          const month = (d.getMonth() + 1).toString().padStart(2, '0');
          const year = d.getFullYear();

          return {
            id: a.id,
            rawDate: d,
            date: `${day} - ${month} - ${year}`,
            time: a.start_time ? a.start_time.substring(0,5) : '',
            status: a.status,
            type: "Terapia Individual",
            duration: "50 min",
            notes: a.notes || 'Sin notas registradas.',
            mood: a.status === 'scheduled' ? 'Programada' : a.status === 'completed' ? 'Completada' : 'Ausente'
          }
        });

        // Actualizar estadísticas del paciente basándose en las citas reales
        const completedSessions = appts.filter((a: any) => a.status === 'completed').length;
        
        // Encontrar la próxima sesión programada (la más cercana en el futuro o la primera programada)
        const scheduledAppts = appts
          .filter((a: any) => a.status === 'scheduled')
          .sort((a: any, b: any) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
          
        let nextSessionText = "Por agendar";
        if (scheduledAppts.length > 0) {
          const nextAppt = scheduledAppts[0];
          const d = new Date(nextAppt.scheduled_date.substring(0, 10) + 'T12:00:00');
          const day = d.getDate().toString().padStart(2, '0');
          const month = (d.getMonth() + 1).toString().padStart(2, '0');
          nextSessionText = `${day}/${month}/${d.getFullYear()}`;
        }

        this.patient.sessionCount = completedSessions;
        this.patient.nextSession = nextSessionText;
      }

      // 4. Obtener evaluaciones de alianza terapéutica (FIT/SRS) para historial de gráfica
      const { data: evals, error: evalsError } = await this.supabase
        .from('session_evaluations')
        .select('created_at, score_global, rupture_flag')
        .eq('patient_id', id)
        .order('created_at', { ascending: true });

      if (evalsError) {
        console.warn('Advertencia obteniendo evaluaciones (posible tabla no migrada):', evalsError);
      }

      if (evals && evals.length > 0) {
        this.allianceStatus = evals[evals.length - 1].rupture_flag as any;

        if (evals.length >= 2) {
          const lastScore = Number(evals[evals.length - 1].score_global);
          const prevScore = Number(evals[evals.length - 2].score_global);
          const diff = prevScore - lastScore;
          if (diff >= 0.7) {
            this.allianceDeclineAlert = true;
            this.allianceDeclineValue = diff;
          }
        }

        const labels = evals.map(e => new Date(e.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' }));
        const dataPoints = evals.map(e => Number(e.score_global));

        this.allianceChartData = {
          labels: labels,
          datasets: [
            {
              data: dataPoints,
              label: 'Alianza (FIT/SRS)',
              borderColor: '#8b5cf6',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        };
      }

      // 5. Obtener datos de gamificación (racha, XP y logros) del paciente
      const { data: streakData } = await this.supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();

      if (streakData) {
        this.patientStreak = streakData;
      } else {
        this.patientStreak = { current_streak: 0, best_streak: 0, total_xp: 0 };
      }

      const { data: userAchs } = await this.supabase
        .from('user_achievements')
        .select('*, achievement:achievements(*)')
        .eq('user_id', id);

      if (userAchs) {
        this.patientAchievements = userAchs.map((ua: any) => ({
          id: ua.achievement.id,
          title: ua.achievement.title,
          description: ua.achievement.description,
          points: ua.achievement.points,
          badge_url: ua.achievement.badge_url || 'verified',
          is_completed: ua.is_completed,
          earned_at: ua.earned_at,
          notes: ua.notes
        }));
      } else {
        this.patientAchievements = [];
      }

    } catch (err) {
      console.error('Unexpected error loading patient data:', err);
    }

    this.generateCalendar();
    this.loading = false;
  }

  getAlertClass(flag: string): string {
    if (flag === 'critical') return 'badge-danger';
    if (flag === 'decline') return 'badge-warning';
    return 'badge-success';
  }

  getAlertText(flag: string): string {
    if (flag === 'critical') return '⚠️ Ruptura';
    if (flag === 'decline') return '📉 Caída';
    return '✅ Sólida';
  }

  openPostSessionModal(session: any) {
    this.router.navigate(['/psychologist/clinical-note', session.id]);
  }

  generateCalendar() {
    this.year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const formatter = new Intl.DateTimeFormat('es-ES', { month: 'long' });
    this.monthName = formatter.format(this.currentDate);
    this.monthName = this.monthName.charAt(0).toUpperCase() + this.monthName.slice(1);

    const firstDay = new Date(this.year, month, 1);
    const lastDay = new Date(this.year, month + 1, 0);

    let startDayOfWeek = firstDay.getDay();
    let blankCount = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    this.blankDays = Array.from({ length: blankCount }, (_, i) => i);
    this.calendarDays = Array.from({ length: lastDay.getDate() }, (_, i) => i + 1);
  }

  prev() {
    if (this.calendarMode === 'days') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    } else {
      this.currentDate = new Date(this.currentDate.getFullYear() - 1, this.currentDate.getMonth(), 1);
    }
    this.generateCalendar();
  }

  next() {
    if (this.calendarMode === 'days') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    } else {
      this.currentDate = new Date(this.currentDate.getFullYear() + 1, this.currentDate.getMonth(), 1);
    }
    this.generateCalendar();
  }

  toggleMode() {
    this.calendarMode = this.calendarMode === 'days' ? 'months' : 'days';
  }

  selectMonth(index: number) {
    this.currentDate = new Date(this.currentDate.getFullYear(), index, 1);
    this.calendarMode = 'days';
    this.generateCalendar();
  }

  getMoodForDay(day: number): string | null {
    const entryForDay = this.diaryEntries.find(e => {
        const d = e.rawDate;
        return d.getDate() === day && d.getMonth() === this.currentDate.getMonth() && d.getFullYear() === this.year;
    });

    if (entryForDay) {
        if (entryForDay.mood && entryForDay.mood !== 'Neutro') {
            return entryForDay.mood.split(' ')[0];
        }
        return '📝'; // Ícono por defecto si no eligió emoción
    }
    return null;
  }

  hasSessionForDay(day: number): boolean {
    return this.sessionHistory.some(s => {
      const d = new Date(s.rawDate);
      return d.getDate() === day && d.getMonth() === this.currentDate.getMonth() && d.getFullYear() === this.year;
    });
  }

  selectDate(day: number) {
    if (this.selectedDate === day) {
      this.selectedDate = null;
    } else {
      this.selectedDate = day;
    }
  }

  get displayedDiaryEntries() {
    if (this.selectedDate !== null) {
      return this.diaryEntries.filter(e => 
        e.rawDate.getDate() === this.selectedDate &&
        e.rawDate.getMonth() === this.currentDate.getMonth() &&
        e.rawDate.getFullYear() === this.year
      );
    }
    return this.diaryEntries.slice(0, 3);
  }

  get displayedSessions() {
    if (this.selectedDate !== null) {
      return this.sessionHistory.filter(s => {
        const d = new Date(s.rawDate);
        return d.getDate() === this.selectedDate && d.getMonth() === this.currentDate.getMonth() && d.getFullYear() === this.year;
      });
    }
    return [];
  }

  goBack() {
    this.router.navigate(['/psychologist/patients']);
  }

  async exportPatientDossier() {
    if (!this.patient?.id) return;
    this.isExporting = true;
    try {
      const blob = await this.dossierExport.exportDossier(this.patient.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dossier_clinico_${this.patient.firstName}_${this.patient.lastName}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al exportar dossier:', err);
      alert('Error al generar el dossier clínico.');
    } finally {
      this.isExporting = false;
    }
  }

  async assignClinicalAchievement() {
    if (!this.patient?.id || !this.newAchTitle.trim() || !this.newAchDesc.trim()) {
      alert('Por favor completa el título y la descripción de la meta.');
      return;
    }

    this.isAssigningAchievement = true;
    try {
      const success = await this.gamificationService.awardClinicalAchievement(
        this.patient.id,
        this.newAchTitle.trim(),
        this.newAchDesc.trim(),
        this.newAchPoints,
        this.newAchIcon,
        this.newAchNotes.trim()
      );

      if (success) {
        alert(`¡Meta clínica "${this.newAchTitle}" asignada con éxito!`);
        // Limpiar formulario
        this.newAchTitle = '';
        this.newAchDesc = '';
        this.newAchNotes = '';
        this.newAchPoints = 100;
        this.newAchIcon = 'verified';
        
        // Recargar datos
        await this.loadPatientData(this.patient.id);
      } else {
        alert('Error al asignar la meta clínica.');
      }
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error inesperado al guardar.');
    } finally {
      this.isAssigningAchievement = false;
    }
  }
}
