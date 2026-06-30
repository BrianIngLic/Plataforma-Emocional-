import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DiaryService } from '../../../core/services/diary.service';
import { FeedbackModalComponent } from '../../../shared/components/feedback-modal/feedback-modal.component';

@Component({
  selector: 'app-diary-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatDialogModule],
  templateUrl: './diary-dashboard.component.html',
  styleUrls: ['./diary-dashboard.component.scss']
})
export class DiaryDashboardComponent implements OnInit {
  diaryService = inject(DiaryService);
  dialog = inject(MatDialog);
  entries = this.diaryService.entries;

  availableMoods = [
    { icon: '😊', label: 'Feliz' },
    { icon: '😌', label: 'Relajado' },
    { icon: '🥺', label: 'Triste' },
    { icon: '😰', label: 'Ansioso' },
    { icon: '😠', label: 'Enojado' },
    { icon: '😪', label: 'Cansado' },
    { icon: '🙏', label: 'Agradecido' }
  ];

  sleepOptions = [
    { icon: '💤', label: 'Menos de 5h (Agotado)', value: 4 },
    { icon: '🥱', label: '5 - 6 horas (Regular)', value: 6 },
    { icon: '🌙', label: '7 - 8 horas (Óptimo)', value: 8 },
    { icon: '✨', label: 'Más de 8h (Profundo)', value: 9 }
  ];

  selectedMoods: string[] = [];
  selectedSleep: number | null = null;
  diaryContent = '';

  // Gamificación y Rachas (Sin presión)
  streakDays = 5;
  streakShieldActive = true;
  activeTab: 'write' | 'breathe' | 'badges' = 'write';

  // Insignias Emocionales
  badges = [
    { id: 'explore', icon: '🌿', title: 'Explorador Emocional', desc: 'Registraste tus emociones en el diario con honestidad.', unlocked: true },
    { id: 'sleep', icon: '🌙', title: 'Guardián del Sueño', desc: 'Registraste tus horas de descanso para entender tu energía vital.', unlocked: false },
    { id: 'brave', icon: '💖', title: 'Corazón Valiente', desc: 'Reconociste una emoción vulnerable (ansiedad o tristeza).', unlocked: false },
    { id: 'calm', icon: '✨', title: 'Mente en Calma', desc: 'Completaste un ciclo de respiración consciente en tu espacio de calma.', unlocked: false },
    { id: 'consistency', icon: '🌟', title: 'Faro de Luz', desc: 'Mantuviste tu diario activo durante 5 días seguidos.', unlocked: true }
  ];

  // Respiración
  breatheText = 'Haz clic en el círculo para iniciar respiración guiada';
  isBreathing = false;
  breathePhase: 'inhale' | 'hold' | 'exhale' | 'idle' = 'idle';
  breatheInterval: any = null;

  // Variables del Calendario
  currentDate = new Date();
  monthName = '';
  year = 0;
  calendarDays: number[] = [];
  blankDays: number[] = [];

  ngOnInit() {
    this.generateCalendar();
  }

  // Afirmación dinámica compasiva
  get dynamicAffirmation(): string {
    if (this.selectedMoods.some(m => m.includes('Ansioso'))) {
      return 'La ansiedad es solo un visitante temporal en tu mente. Tómate un momento, respira despacio... estás en un lugar seguro.';
    } else if (this.selectedMoods.some(m => m.includes('Triste') || m.includes('Cansado'))) {
      return 'Es de valientes reconocer cuando el corazón pesa o el cuerpo está exhausto. Descansa sin culpa, mereces cuidarte.';
    } else if (this.selectedMoods.some(m => m.includes('Enojado'))) {
      return 'Tu enojo es válido y trae un mensaje sobre tus límites. Déjalo salir en estas páginas sin temor.';
    } else if (this.selectedMoods.length > 0 || this.selectedSleep !== null) {
      return 'Cada emoción y cada hora de descanso son claves para tu bienestar. Gracias por dedicarte este momento hoy.';
    }
    return 'Este es tu refugio digital. Sin juicios, sin prisas. Escribe lo que necesites o practica un respiro.';
  }

  startBreathing() {
    if (this.isBreathing) {
      this.stopBreathing();
      return;
    }
    this.isBreathing = true;
    const b = this.badges.find(x => x.id === 'calm');
    if (b) b.unlocked = true;

    this.runBreatheCycle();
    this.breatheInterval = setInterval(() => {
      this.runBreatheCycle();
    }, 12000); // 4s inhale, 4s hold, 4s exhale
  }

  runBreatheCycle() {
    this.breathePhase = 'inhale';
    this.breatheText = 'Inhala profundamente por la nariz... (4s)';
    setTimeout(() => {
      if (!this.isBreathing) return;
      this.breathePhase = 'hold';
      this.breatheText = 'Mantén el aire con suavidad... (4s)';
      setTimeout(() => {
        if (!this.isBreathing) return;
        this.breathePhase = 'exhale';
        this.breatheText = 'Exhala lentamente por la boca... (4s)';
      }, 4000);
    }, 4000);
  }

  stopBreathing() {
    this.isBreathing = false;
    this.breathePhase = 'idle';
    this.breatheText = 'Haz clic en el círculo para iniciar respiración guiada';
    if (this.breatheInterval) clearInterval(this.breatheInterval);
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

  getMoodForDay(day: number): string | null {
    const allEntries = this.entries();
    const entryForDay = allEntries.find(e => {
        const d = new Date(e.date);
        return d.getDate() === day && d.getMonth() === this.currentDate.getMonth() && d.getFullYear() === this.year;
    });

    if (entryForDay && entryForDay.moods && entryForDay.moods.length > 0) {
        return entryForDay.moods[0].split(' ')[0];
    }
    return null;
  }

  toggleMood(moodLabel: string, icon: string) {
    const fullMood = `${icon} ${moodLabel}`;
    const idx = this.selectedMoods.indexOf(fullMood);
    if (idx > -1) {
      this.selectedMoods.splice(idx, 1);
    } else {
      this.selectedMoods.push(fullMood);
      if (moodLabel === 'Ansioso' || moodLabel === 'Triste' || moodLabel === 'Enojado') {
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

  saveDiary() {
    if (this.diaryContent.trim() && (this.selectedMoods.length > 0 || this.selectedSleep !== null)) {
      this.diaryService.saveEntry(this.diaryContent, this.selectedMoods, this.selectedSleep);
      this.diaryContent = '';
      this.selectedMoods = [];
      this.selectedSleep = null;
      this.streakDays++;
      
      this.dialog.open(FeedbackModalComponent, {
        width: '420px',
        data: {
          type: 'success',
          title: '¡Entrada Guardada!',
          message: '🌸 Gracias por dedicarte este momento de compasión y reflexión. Tu racha se ha fortalecido.',
          btnText: 'Aceptar'
        }
      });
    } else {
      this.dialog.open(FeedbackModalComponent, {
        width: '420px',
        data: {
          type: 'error',
          title: 'Faltan datos',
          message: '🌿 Por favor selecciona al menos una emoción o tus horas de descanso, y escribe algunas palabras sobre tu sentir.',
          btnText: 'Entendido'
        }
      });
    }
  }
}
