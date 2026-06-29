import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-emoji-scale',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './emoji-scale.component.html',
  styleUrls: ['./emoji-scale.component.scss']
})
export class EmojiScaleComponent {
  @Input() question: string = '';
  @Input() questionNumber: number = 1;
  @Input() totalQuestions: number = 4;
  @Output() scored = new EventEmitter<number>();

  selectedRating = signal<number | null>(null);

  emojis = [
    { value: 1, char: '😞', label: 'Nada satisfecho', color: '#ef4444', animation: 'empathy-pulse' },
    { value: 2, char: '😐', label: 'Poco satisfecho', color: '#f97316', animation: 'empathy-pulse' },
    { value: 3, char: '🙂', label: 'Neutral', color: '#eab308', animation: 'empathy-pulse' },
    { value: 4, char: '😊', label: 'Satisfecho', color: '#22c55e', animation: 'bounce' },
    { value: 5, char: '🤩', label: '¡Muy satisfecho!', color: '#6366f1', animation: 'bounce' }
  ];

  selectEmoji(value: number) {
    this.selectedRating.set(value);
    setTimeout(() => {
      this.scored.emit(value);
      this.selectedRating.set(null); // Reset for next question
    }, 500);
  }

  getProgressWidth(): string {
    return `${(this.questionNumber / this.totalQuestions) * 100}%`;
  }
}
