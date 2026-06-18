import { Component, inject, OnInit } from '@angular/core';
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
export class DiaryDashboardComponent implements OnInit {
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

  // Variables del Calendario
  currentDate = new Date();
  monthName = '';
  year = 0;
  calendarDays: number[] = [];
  blankDays: number[] = [];

  ngOnInit() {
    this.generateCalendar();
  }

  generateCalendar() {
    this.year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    // Obtener nombre del mes en español
    const formatter = new Intl.DateTimeFormat('es-ES', { month: 'long' });
    this.monthName = formatter.format(this.currentDate);
    this.monthName = this.monthName.charAt(0).toUpperCase() + this.monthName.slice(1);

    const firstDay = new Date(this.year, month, 1);
    const lastDay = new Date(this.year, month + 1, 0);

    // Calcular días en blanco iniciales (el Lunes es el día 0 visualmente)
    let startDayOfWeek = firstDay.getDay(); // 0 es Domingo, 1 es Lunes
    let blankCount = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    this.blankDays = Array.from({ length: blankCount }, (_, i) => i);
    
    // Arreglo de días del mes
    this.calendarDays = Array.from({ length: lastDay.getDate() }, (_, i) => i + 1);
  }

  // Encuentra la emoción dominante para pintar en el calendario en un día específico
  getMoodForDay(day: number): string | null {
    const allEntries = this.entries();
    const entryForDay = allEntries.find(e => {
        const d = new Date(e.date);
        return d.getDate() === day && d.getMonth() === this.currentDate.getMonth() && d.getFullYear() === this.year;
    });

    if (entryForDay && entryForDay.moods && entryForDay.moods.length > 0) {
        // Los moods guardan el string '😊 Feliz', dividimos por espacio para quedarnos solo con el emoji '😊'
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
