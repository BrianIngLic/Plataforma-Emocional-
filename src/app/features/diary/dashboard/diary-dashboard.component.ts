import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DiaryService } from '../../../core/services/diary.service';

@Component({
  selector: 'app-diary-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule],
  templateUrl: './diary-dashboard.component.html',
  styleUrls: ['./diary-dashboard.component.scss']
})
export class DiaryDashboardComponent {
  diaryService = inject(DiaryService);
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

  selectedMoods: string[] = [];
  diaryContent = '';

  // Calendario mock (Junio 2026 como ejemplo estático por ahora)
  calendarDays = Array.from({length: 30}, (_, i) => i + 1);

  toggleMood(moodLabel: string, icon: string) {
    const fullMood = `${icon} ${moodLabel}`;
    const idx = this.selectedMoods.indexOf(fullMood);
    if (idx > -1) {
      this.selectedMoods.splice(idx, 1);
    } else {
      this.selectedMoods.push(fullMood);
    }
  }

  saveDiary() {
    if (this.diaryContent.trim() && this.selectedMoods.length > 0) {
      this.diaryService.saveEntry(this.diaryContent, this.selectedMoods);
      this.diaryContent = '';
      this.selectedMoods = [];
      alert('Entrada guardada en tu diario. Continúa escribiendo siempre que lo necesites.');
    } else {
      alert('Por favor selecciona al menos una emoción y escribe cómo te sientes.');
    }
  }
}
