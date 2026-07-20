import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { QuillModule } from 'ngx-quill';
import { DiaryService, FoodDiaryEntry } from '../../../core/services/diary.service';
import { FeedbackModalComponent } from '../../../shared/components/feedback-modal/feedback-modal.component';

/** Opciones de estado emocional compartidas (diario emocional + alimentario) */
const MOOD_OPTIONS = [
  { icon: '😄', label: 'Excelente' },
  { icon: '😊', label: 'Bien' },
  { icon: '😌', label: 'Tranquilo' },
  { icon: '😐', label: 'Regular' },
  { icon: '😰', label: 'Ansioso' },
  { icon: '🥺', label: 'Triste' },
  { icon: '😠', label: 'Enojado' },
  { icon: '😵', label: 'Abrumado' }
];

/** Opciones de sueño */
const SLEEP_OPTIONS = [
  { icon: '💤', label: 'Menos de 5h (Agotado)', value: 4 },
  { icon: '🥱', label: '5 - 6 horas (Regular)', value: 6 },
  { icon: '🌙', label: '7 - 8 horas (Óptimo)', value: 8 },
  { icon: '✨', label: 'Más de 8h (Profundo)', value: 9 }
];

const QUILL_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['clean']
  ]
};

@Component({
  selector: 'app-diary-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    QuillModule
  ],
  templateUrl: './diary-dashboard.component.html',
  styleUrls: ['./diary-dashboard.component.scss']
})
export class DiaryDashboardComponent implements OnInit {
  diaryService = inject(DiaryService);
  dialog       = inject(MatDialog);
  private route = inject(ActivatedRoute);

  entries    = this.diaryService.entries;
  foodEntries = this.diaryService.foodEntries;

  // ─── Datos compartidos ────────────────────────────────────────────
  availableMoods = MOOD_OPTIONS;
  sleepOptions   = SLEEP_OPTIONS;
  quillModules   = QUILL_MODULES;

  // ─── Estado: diario emocional ─────────────────────────────────────
  selectedMoods: string[] = [];
  selectedSleep: number | null = null;
  diaryContent = '';
  editingDiaryId = signal<string | null>(null);

  // ─── Estado: UI general ───────────────────────────────────────────
  streakDays = 5;
  streakShieldActive = true;
  activeTab: 'write' | 'breathe' = 'write';

  badges = [
    { id: 'explore',     icon: '🌿', title: 'Explorador Emocional',   desc: 'Registraste tus emociones en el diario con honestidad.',          unlocked: true  },
    { id: 'sleep',       icon: '🌙', title: 'Guardián del Sueño',      desc: 'Registraste tus horas de descanso para entender tu energía vital.', unlocked: false },
    { id: 'brave',       icon: '💖', title: 'Corazón Valiente',        desc: 'Reconociste una emoción vulnerable (ansiedad o tristeza).',         unlocked: false },
    { id: 'calm',        icon: '✨', title: 'Mente en Calma',          desc: 'Completaste un ciclo de respiración consciente en tu espacio de calma.', unlocked: false },
    { id: 'consistency', icon: '🌟', title: 'Faro de Luz',             desc: 'Mantuviste tu diario activo durante 5 días seguidos.',              unlocked: true  }
  ];

  // ─── Estado: respiración ──────────────────────────────────────────
  breatheText  = 'Haz clic en el círculo para iniciar respiración guiada';
  isBreathing  = false;
  breathePhase: 'inhale' | 'hold' | 'exhale' | 'idle' = 'idle';
  breatheInterval: any = null;

  // ─── Estado: calendario ───────────────────────────────────────────
  currentDate  = new Date();
  monthName    = '';
  year         = 0;
  calendarDays: number[] = [];
  blankDays:    number[] = [];
  selectedDay:  number | null = null;

  // ─── Estado: formulario de nueva entrada alimentaria ─────────────
  showFoodForm     = false;
  editingFoodId: string | null = null;

  newMealTime    = this.getCurrentTime();
  newMoodBefore  = '';
  newWhatIAte    = '';
  newMoodAfter   = '';
  isSavingFood   = false;

  // ─── Estado: PHQ-9 Chatbot ────────────────────────────────────────
  showPhq9 = false;
  phq9CurrentQuestionIndex = 0;
  phq9Answers: any = {};
  phq9Finished = false;
  isPhq9Typing = false;
  isJumping = false;
  phq9Messages: any[] = [];
  primaryPsychologistId: string | null = null;
  phq9Config: any = null;
  lastPhq9CompletedDate: string | null = null;
  hasUpcomingSession = false;

  phq9Questions = [
    { id: 'q1', text: 'Poco interés o placer en hacer cosas.' },
    { id: 'q2', text: 'Se ha sentido decaído(a), deprimido(a) o sin esperanzas.' },
    { id: 'q3', text: 'Ha tenido dificultad para quedarse o permanecer dormido(a), o ha dormido demasiado.' },
    { id: 'q4', text: 'Se ha sentido cansado(a) o con poca energía.' },
    { id: 'q5', text: 'Sin apetito o ha comido en exceso.' },
    { id: 'q6', text: 'Se ha sentido mal con usted mismo(a) – o que es un fracaso o que ha quedado mal con usted mismo(a) o con su familia.' },
    { id: 'q7', text: 'Ha tenido dificultad para concentrarse en ciertas actividades, tales como leer el periódico o ver la televisión.' },
    { id: 'q8', text: '¿Se ha movido o hablado tan lento que otras personas podrían haberlo notado? o lo contrario – muy inquieto(a) o agitado(a) que ha estado moviéndose mucho más de lo normal.' },
    { id: 'q9', text: 'Pensamientos de que estaría mejor muerto(a) o de lastimarse de alguna manera.' },
    { id: 'q10', text: '¿Qué tanta dificultad le han dado estos problemas para hacer su trabajo, encargarse de las tareas del hogar, o llevarse bien con otras personas?' }
  ];

  get currentPhq9Question() {
    return this.phq9Questions[this.phq9CurrentQuestionIndex];
  }

  getProgressRatio(): number {
    return this.phq9CurrentQuestionIndex / (this.phq9Questions.length - 1);
  }

  triggerDolphinJump() {
    this.isJumping = true;
    setTimeout(() => {
      this.isJumping = false;
    }, 600);
  }

  async checkPhq9Status() {
    const configData = await this.diaryService.getPhq9Config();
    this.phq9Config = configData.config;
    this.primaryPsychologistId = configData.primary_psychologist_id;
    this.lastPhq9CompletedDate = configData.lastCompleted;
    this.hasUpcomingSession = configData.hasUpcomingSession;

    // Si no ha completado el PHQ-9 nunca, es obligatorio
    if (!this.lastPhq9CompletedDate) {
      this.showPhq9 = true;
      this.startPhq9Chat();
      return;
    }

    const mode = this.phq9Config?.mode || 'weeks';
    const value = this.phq9Config?.value ?? 4;
    
    // Si no hay psicólogo asignado, el fallback es 4 semanas (28 días)
    const targetMode = this.primaryPsychologistId ? mode : 'weeks';
    const targetValue = this.primaryPsychologistId ? value : 4;

    if (targetMode === 'manual') {
      this.showPhq9 = false;
      return;
    }

    const lastCompleted = new Date(this.lastPhq9CompletedDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastCompleted.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (targetMode === 'weeks') {
      const daysLimit = targetValue * 7;
      if (diffDays >= daysLimit) {
        this.showPhq9 = true;
        this.startPhq9Chat();
      }
    } else if (targetMode === 'months') {
      const daysLimit = targetValue * 30;
      if (diffDays >= daysLimit) {
        this.showPhq9 = true;
        this.startPhq9Chat();
      }
    } else if (targetMode === 'before_session') {
      if (this.hasUpcomingSession && diffDays >= 3) {
        this.showPhq9 = true;
        this.startPhq9Chat();
      }
    }
  }

  startPhq9Chat() {
    this.phq9CurrentQuestionIndex = 0;
    this.phq9Answers = {};
    this.phq9Finished = false;
    this.phq9Messages = [
      {
        sender: 'amati',
        text: '¡Hola! 🐬 Soy Amati, tu delfín guía de bienestar. Hoy realizaremos el Cuestionario de Salud del Paciente (PHQ-9) sobre cómo te has sentido en las últimas 2 semanas. Consta de 9 preguntas rápidas sobre tu bienestar. ¿Comenzamos?'
      }
    ];
  }

  startQuiz() {
    this.phq9Messages.push({
      sender: 'user',
      text: '¡Sí, comencemos!'
    });
    this.askQuestion(0);
  }

  askQuestion(index: number) {
    this.isPhq9Typing = true;
    setTimeout(() => {
      this.isPhq9Typing = false;
      const question = this.phq9Questions[index];
      this.phq9Messages.push({
        sender: 'amati',
        text: question.text,
        isQuestion: true,
        questionId: question.id,
        options: index < 9 ? [
          { text: 'Ningún día', value: 0 },
          { text: 'Varios días', value: 1 },
          { text: 'Más de la mitad de los días', value: 2 },
          { text: 'Casi todos los días', value: 3 }
        ] : [
          { text: 'No ha sido difícil', value: 0 },
          { text: 'Un poco difícil', value: 1 },
          { text: 'Muy difícil', value: 2 },
          { text: 'Extremadamente difícil', value: 3 }
        ]
      });
      this.scrollToBottom();
    }, 600);
  }

  selectPhq9Option(questionId: string, text: string, value: number) {
    const lastMsg = this.phq9Messages[this.phq9Messages.length - 1];
    if (!lastMsg || lastMsg.questionId !== questionId) return;

    lastMsg.isQuestion = false;
    this.phq9Answers[questionId] = { text, value };

    const currentOptions = questionId === 'q10' ? [
      { text: 'No ha sido difícil', value: 0 },
      { text: 'Un poco difícil', value: 1 },
      { text: 'Muy difícil', value: 2 },
      { text: 'Extremadamente difícil', value: 3 }
    ] : [
      { text: 'Ningún día', value: 0 },
      { text: 'Varios días', value: 1 },
      { text: 'Más de la mitad de los días', value: 2 },
      { text: 'Casi todos los días', value: 3 }
    ];

    this.phq9Messages.push({
      sender: 'user',
      text: text,
      questionId: questionId,
      options: currentOptions
    });

    this.triggerDolphinJump();
    this.scrollToBottom();

    if (this.phq9CurrentQuestionIndex < 8) {
      this.phq9CurrentQuestionIndex++;
      this.askQuestion(this.phq9CurrentQuestionIndex);
    } else if (this.phq9CurrentQuestionIndex === 8) {
      let totalScore = 0;
      for (let i = 1; i <= 9; i++) {
        totalScore += this.phq9Answers['q' + i]?.value ?? 0;
      }

      if (totalScore > 0) {
        this.phq9CurrentQuestionIndex = 9;
        this.askQuestion(9);
      } else {
        this.finishPhq9Quiz();
      }
    } else {
      this.finishPhq9Quiz();
    }
  }

  editPhq9Answer(msg: any) {
    if (msg.sender !== 'user' || this.isPhq9Typing || this.phq9Finished) return;
    msg.isEditing = true;
  }

  savePhq9Edit(msg: any, newOpt: { text: string; value: number }) {
    if (msg.questionId) {
      this.phq9Answers[msg.questionId] = { text: newOpt.text, value: newOpt.value };
    }
    msg.text = newOpt.text;
    msg.isEditing = false;
  }

  async finishPhq9Quiz() {
    this.isPhq9Typing = true;
    setTimeout(async () => {
      this.isPhq9Typing = false;
      this.phq9Finished = true;

      let totalScore = 0;
      for (let i = 1; i <= 9; i++) {
        totalScore += this.phq9Answers['q' + i]?.value ?? 0;
      }

      let severity = '';
      let action = '';
      if (totalScore <= 4) {
        severity = 'Depresión Mínima / Sin depresión';
        action = 'Ninguno en particular.';
      } else if (totalScore <= 9) {
        severity = 'Depresión Leve';
        action = 'Vigilancia clínica y re-evaluación periódica.';
      } else if (totalScore <= 14) {
        severity = 'Depresión Moderada';
        action = 'Plan de tratamiento activo (asesoramiento, seguimiento y/o farmacoterapia).';
      } else if (totalScore <= 19) {
        severity = 'Depresión Moderadamente Severa';
        action = 'Tratamiento activo inmediato con psicoterapia y/o farmacoterapia.';
      } else {
        severity = 'Depresión Severa';
        action = 'Intervención inmediata, psicoterapia intensiva y/o derivación psiquiátrica urgente.';
      }

      this.phq9Messages.push({
        sender: 'amati',
        text: `¡Excelente! Has completado el cuestionario de forma exitosa. Tus respuestas han sido guardadas de forma segura y encriptada en tu expediente clínico para que tu especialista pueda darte un mejor seguimiento. ¡Muchas gracias por tu valiosa participación! 🐬💙`
      });

      this.scrollToBottom();

      let summaryText = `**Cuestionario de Salud del Paciente (PHQ-9) completado**\n\n`;
      summaryText += `- **Puntuación total:** ${totalScore}/27\n`;
      summaryText += `- **Nivel de severidad:** ${severity}\n`;
      summaryText += `- **Recomendación clínica:** ${action}\n\n`;
      summaryText += `**Respuestas detalladas:**\n`;
      this.phq9Questions.forEach((q, idx) => {
        const ans = this.phq9Answers[q.id];
        if (ans) {
          summaryText += `${idx + 1}. ${q.text}: **${ans.text}** (Puntaje: ${ans.value})\n`;
        }
      });

      await this.diaryService.saveEntry(
        summaryText,
        ['📊 PHQ-9'],
        null,
        'phq9',
        totalScore,
        this.phq9Answers
      );

      this.streakDays++;
      
      this.dialog.open(FeedbackModalComponent, {
        width: '420px',
        data: {
          type: 'success',
          title: '¡Cuestionario Completado!',
          message: '🌟 Tus respuestas se han registrado correctamente en el expediente y has fortalecido tu racha. ¡Sigue así!',
          btnText: 'Aceptar'
        }
      });

    }, 1000);
  }

  closePhq9UI() {
    this.showPhq9 = false;
    this.diaryService.loadEntries();
  }

  scrollToBottom() {
    setTimeout(() => {
      const chatContainer = document.querySelector('.phq9-chat-messages');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }

  // ════════════════════════════════════════════════════════════════
  // CICLO DE VIDA
  // ════════════════════════════════════════════════════════════════
  async ngOnInit() {
    this.generateCalendar();
    this.diaryService.loadFoodEntries();
    this.diaryService.loadEntries();
    await this.checkPhq9Status();
  }

  // ════════════════════════════════════════════════════════════════
  // UTILIDADES
  // ════════════════════════════════════════════════════════════════
  getCurrentTime(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  stripHtml(html: string): string {
    return this.diaryService.stripHtml(html);
  }

  // ════════════════════════════════════════════════════════════════
  // AFIRMACIÓN DINÁMICA
  // ════════════════════════════════════════════════════════════════
  get dynamicAffirmation(): string {
    if (this.selectedMoods.some(m => m.includes('Ansioso')))
      return 'La ansiedad es solo un visitante temporal en tu mente. Tómate un momento, respira despacio... estás en un lugar seguro.';
    if (this.selectedMoods.some(m => m.includes('Triste') || m.includes('Cansado')))
      return 'Es de valientes reconocer cuando el corazón pesa o el cuerpo está exhausto. Descansa sin culpa, mereces cuidarte.';
    if (this.selectedMoods.some(m => m.includes('Enojado')))
      return 'Tu enojo es válido y trae un mensaje sobre tus límites. Déjalo salir en estas páginas sin temor.';
    if (this.selectedMoods.length > 0 || this.selectedSleep !== null)
      return 'Cada emoción y cada hora de descanso son claves para tu bienestar. Gracias por dedicarte este momento hoy.';
    return 'Este es tu refugio digital. Sin juicios, sin prisas. Escribe lo que necesites o practica un respiro.';
  }

  // ════════════════════════════════════════════════════════════════
  // DIARIO EMOCIONAL
  // ════════════════════════════════════════════════════════════════
  toggleMood(moodLabel: string, icon: string) {
    const fullMood = `${icon} ${moodLabel}`;
    const idx = this.selectedMoods.indexOf(fullMood);
    if (idx > -1) {
      this.selectedMoods.splice(idx, 1);
    } else {
      this.selectedMoods.push(fullMood);
      if (['Ansioso', 'Triste', 'Enojado'].includes(moodLabel)) {
        const b = this.badges.find(x => x.id === 'brave');
        if (b) b.unlocked = true;
      }
    }
  }

  selectSleep(val: number) {
    this.selectedSleep = this.selectedSleep === val ? null : val;
    if (this.selectedSleep !== null) {
      const b = this.badges.find(x => x.id === 'sleep');
      if (b) b.unlocked = true;
    }
  }

  editDiaryEntry(entry: any) {
    this.editingDiaryId.set(entry.id);
    this.diaryContent = entry.content;
    this.selectedMoods = [...entry.moods];
    this.selectedSleep = entry.sleepHours;
    setTimeout(() => {
      document.querySelector('.editor-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  cancelDiaryEdit() {
    this.editingDiaryId.set(null);
    this.diaryContent = '';
    this.selectedMoods = [];
    this.selectedSleep = null;
  }

  async saveDiary() {
    if (this.diaryContent.trim() && (this.selectedMoods.length > 0 || this.selectedSleep !== null)) {
      const diaryId = this.editingDiaryId();
      if (diaryId) {
        await this.diaryService.updateEntry(diaryId, this.diaryContent, this.selectedMoods, this.selectedSleep);
        this.editingDiaryId.set(null);
        this.dialog.open(FeedbackModalComponent, {
          width: '420px',
          data: { type: 'success', title: '¡Entrada Actualizada!', message: '🌸 Tu entrada de diario emocional ha sido actualizada exitosamente.', btnText: 'Aceptar' }
        });
      } else {
        await this.diaryService.saveEntry(this.diaryContent, this.selectedMoods, this.selectedSleep);
        this.streakDays++;
        this.dialog.open(FeedbackModalComponent, {
          width: '420px',
          data: { type: 'success', title: '¡Entrada Guardada!', message: '🌸 Gracias por dedicarte este momento de compasión y reflexión. Tu racha se ha fortalecido.', btnText: 'Aceptar' }
        });
      }
      this.diaryContent  = '';
      this.selectedMoods = [];
      this.selectedSleep = null;
    } else {
      this.dialog.open(FeedbackModalComponent, {
        width: '420px',
        data: { type: 'error', title: 'Faltan datos', message: '🌿 Por favor selecciona al menos una emoción o tus horas de descanso, y escribe algunas palabras sobre tu sentir.', btnText: 'Entendido' }
      });
    }
  }

  // ════════════════════════════════════════════════════════════════
  // DIARIO ALIMENTARIO
  // ════════════════════════════════════════════════════════════════

  openFoodForm() {
    this.editingFoodId = null;
    this.newMealTime   = this.getCurrentTime();
    this.newMoodBefore = '';
    this.newWhatIAte   = '';
    this.newMoodAfter  = '';
    this.showFoodForm  = true;
  }

  editFoodEntry(entry: FoodDiaryEntry) {
    this.editingFoodId = entry.id;
    this.newMealTime   = entry.meal_time.substring(0, 5);
    this.newMoodBefore = entry.mood_before;
    this.newWhatIAte   = entry.what_i_ate;
    this.newMoodAfter  = entry.mood_after;
    this.showFoodForm  = true;
    // Scroll al formulario
    setTimeout(() => document.querySelector('.food-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  cancelFoodForm() {
    this.showFoodForm  = false;
    this.editingFoodId = null;
    this.newMealTime   = this.getCurrentTime();
    this.newMoodBefore = '';
    this.newWhatIAte   = '';
    this.newMoodAfter  = '';
  }

  isFoodFormValid(): boolean {
    return !!(
      this.newMealTime &&
      this.newMoodBefore &&
      this.stripHtml(this.newWhatIAte).length > 0 &&
      this.newMoodAfter
    );
  }

  async saveFoodEntry() {
    if (!this.isFoodFormValid()) return;

    this.isSavingFood = true;
    const targetDate = this.diaryService.activeDate();

    if (this.editingFoodId) {
      await this.diaryService.updateFoodEntry(this.editingFoodId, {
        meal_time:   this.newMealTime,
        mood_before: this.newMoodBefore,
        what_i_ate:  this.newWhatIAte,
        mood_after:  this.newMoodAfter
      });
    } else {
      await this.diaryService.saveFoodEntry({
        diary_date:  targetDate,
        meal_time:   this.newMealTime,
        mood_before: this.newMoodBefore,
        what_i_ate:  this.newWhatIAte,
        mood_after:  this.newMoodAfter
      });
    }

    this.isSavingFood = false;
    this.cancelFoodForm();
  }

  async deleteFoodEntry(id: string) {
    await this.diaryService.deleteFoodEntry(id);
  }

  // ════════════════════════════════════════════════════════════════
  // RESPIRACIÓN
  // ════════════════════════════════════════════════════════════════
  startBreathing() {
    if (this.isBreathing) { this.stopBreathing(); return; }
    this.isBreathing = true;
    const b = this.badges.find(x => x.id === 'calm');
    if (b) b.unlocked = true;
    this.runBreatheCycle();
    this.breatheInterval = setInterval(() => this.runBreatheCycle(), 12000);
  }

  runBreatheCycle() {
    this.breathePhase = 'inhale';
    this.breatheText  = 'Inhala profundamente por la nariz... (4s)';
    setTimeout(() => {
      if (!this.isBreathing) return;
      this.breathePhase = 'hold';
      this.breatheText  = 'Mantén el aire con suavidad... (4s)';
      setTimeout(() => {
        if (!this.isBreathing) return;
        this.breathePhase = 'exhale';
        this.breatheText  = 'Exhala lentamente por la boca... (4s)';
      }, 4000);
    }, 4000);
  }

  stopBreathing() {
    this.isBreathing  = false;
    this.breathePhase = 'idle';
    this.breatheText  = 'Haz clic en el círculo para iniciar respiración guiada';
    if (this.breatheInterval) clearInterval(this.breatheInterval);
  }

  // ════════════════════════════════════════════════════════════════
  // CALENDARIO
  // ════════════════════════════════════════════════════════════════
  generateCalendar() {
    this.year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const formatter = new Intl.DateTimeFormat('es-ES', { month: 'long' });
    this.monthName = formatter.format(this.currentDate);
    this.monthName = this.monthName.charAt(0).toUpperCase() + this.monthName.slice(1);
    const firstDay = new Date(this.year, month, 1);
    const lastDay  = new Date(this.year, month + 1, 0);
    const startDow = firstDay.getDay();
    const blankCount = startDow === 0 ? 6 : startDow - 1;
    this.blankDays   = Array.from({ length: blankCount }, (_, i) => i);
    this.calendarDays = Array.from({ length: lastDay.getDate() }, (_, i) => i + 1);
  }

  isFutureDay(day: number): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(this.year, this.currentDate.getMonth(), day);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate.getTime() > today.getTime();
  }

  getMoodForDay(day: number): string | null {
    const entry = this.entries().find(e => {
      const d = new Date(e.date);
      return d.getDate() === day && d.getMonth() === this.currentDate.getMonth() && d.getFullYear() === this.year;
    });
    return entry?.moods?.[0]?.split(' ')[0] ?? null;
  }

  async selectDate(day: number) {
    if (this.isFutureDay(day)) return;

    if (this.selectedDay === day) {
      this.selectedDay = null;
      // Por defecto, recargar comidas de hoy
      this.diaryService.activeDate.set(new Date().toISOString().split('T')[0]);
      await this.diaryService.loadFoodEntries();
    } else {
      this.selectedDay = day;
      const monthStr = String(this.currentDate.getMonth() + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${this.year}-${monthStr}-${dayStr}`;
      this.diaryService.activeDate.set(dateStr);
      await this.diaryService.loadFoodEntries();
    }
  }

  get displayedEntries() {
    if (this.selectedDay !== null) {
      return this.entries().filter(e => {
        const d = new Date(e.date);
        return d.getDate() === this.selectedDay &&
          d.getMonth() === this.currentDate.getMonth() &&
          d.getFullYear() === this.year;
      });
    }
    return this.entries();
  }
}
