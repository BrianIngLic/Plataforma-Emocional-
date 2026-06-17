import { Injectable, signal } from '@angular/core';

export interface DiaryEntry {
  id: string;
  date: string;
  content: string;
  moods: string[];
  highRisk: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DiaryService {
  private entriesSignal = signal<DiaryEntry[]>([
    {
      id: '1',
      date: new Date().toISOString(),
      content: 'Hoy me sentí un poco agobiado por los exámenes, pero logré relajarme al final del día platicando con un amigo.',
      moods: ['😰 Ansioso', '😌 Relajado'],
      highRisk: false
    }
  ]);
  public entries = this.entriesSignal.asReadonly();

  saveEntry(content: string, moods: string[]) {
    // Simulador simple de NLP para detectar riesgo (Mock del Core de IA)
    const lowerContent = content.toLowerCase();
    const highRiskWords = ['morir', 'suicidio', 'no vale la pena', 'acabar con todo', 'no quiero vivir'];
    const isHighRisk = highRiskWords.some(word => lowerContent.includes(word));

    const newEntry: DiaryEntry = {
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString(),
      content,
      moods,
      highRisk: isHighRisk
    };

    this.entriesSignal.update(entries => [newEntry, ...entries]);

    if (isHighRisk) {
      console.warn('ALERTA CLÍNICA: Entrada marcada con alto riesgo. El psicólogo ha sido notificado.');
    }
  }
}
