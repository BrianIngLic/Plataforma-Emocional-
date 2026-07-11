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
import { AchievementsDashboardComponent } from '../../gamification/achievements-dashboard/achievements-dashboard.component';

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
    QuillModule,
    AchievementsDashboardComponent
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

  // ─── Estado: UI general ───────────────────────────────────────────
  streakDays = 5;
  streakShieldActive = true;
  activeTab: 'write' | 'breathe' | 'badges' = 'write';

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

  // ════════════════════════════════════════════════════════════════
  // CICLO DE VIDA
  // ════════════════════════════════════════════════════════════════
  ngOnInit() {
    this.generateCalendar();
    this.diaryService.loadFoodEntries();
    this.diaryService.loadEntries();

    // Activar pestaña de logros si viene en queryParams
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'badges') {
        this.activeTab = 'badges';
      }
    });
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

  async saveDiary() {
    if (this.diaryContent.trim() && (this.selectedMoods.length > 0 || this.selectedSleep !== null)) {
      await this.diaryService.saveEntry(this.diaryContent, this.selectedMoods, this.selectedSleep);
      this.diaryContent  = '';
      this.selectedMoods = [];
      this.selectedSleep = null;
      this.streakDays++;
      this.dialog.open(FeedbackModalComponent, {
        width: '420px',
        data: { type: 'success', title: '¡Entrada Guardada!', message: '🌸 Gracias por dedicarte este momento de compasión y reflexión. Tu racha se ha fortalecido.', btnText: 'Aceptar' }
      });
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

  getMoodForDay(day: number): string | null {
    const entry = this.entries().find(e => {
      const d = new Date(e.date);
      return d.getDate() === day && d.getMonth() === this.currentDate.getMonth() && d.getFullYear() === this.year;
    });
    return entry?.moods?.[0]?.split(' ')[0] ?? null;
  }

  async selectDate(day: number) {
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
