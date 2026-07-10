import { Injectable } from '@angular/core';

export interface RegistroAyerSnapshot extends Record<string, unknown> {
  paciente_id: string;
  fecha_referencia: string;
  desayuno: string;
  comida: string;
  cena: string;
  colaciones: string[];
  observaciones: string;
  completado: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CalendarioService {
  async obtenerRegistroAyer(pacienteId: string): Promise<RegistroAyerSnapshot> {
    const storageKey = `calendario_snapshot_${pacienteId}`;
    const stored = sessionStorage.getItem(storageKey);

    if (stored) {
      return JSON.parse(stored) as RegistroAyerSnapshot;
    }

    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);

    return {
      paciente_id: pacienteId,
      fecha_referencia: ayer.toISOString(),
      desayuno: 'No registrado',
      comida: 'No registrado',
      cena: 'No registrado',
      colaciones: [],
      observaciones: 'Snapshot simulado del calendario alimentario de ayer.',
      completado: false
    };
  }
}
