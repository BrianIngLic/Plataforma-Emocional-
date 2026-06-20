import { Injectable, signal } from '@angular/core';

export type UrgencyLevel = 'bajo_riesgo' | 'medio_riesgo' | 'alto_riesgo';

@Injectable({
  providedIn: 'root'
})
export class AiTriageMockService {
  // Estado reactivo inicializado en bajo_riesgo por defecto
  currentUrgency = signal<UrgencyLevel>('bajo_riesgo');

  setUrgency(level: UrgencyLevel) {
    this.currentUrgency.set(level);
  }

  // Simula un análisis asíncrono
  async simulateAnalysis(): Promise<UrgencyLevel> {
    return new Promise(resolve => {
      setTimeout(() => {
        // En el futuro, aquí se llamará al backend real
        resolve(this.currentUrgency());
      }, 1500);
    });
  }
}
