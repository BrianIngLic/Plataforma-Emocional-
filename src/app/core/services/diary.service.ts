import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { CryptoService } from './crypto.service';
import { AuthService } from './auth.service';
import { GamificationService } from './gamification.service';

export interface DiaryEntry {
  id: string;
  date: string;
  content: string;
  moods: string[];
  sleepHours?: number | null;
  highRisk: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DiaryService {
  private supabaseService = inject(SupabaseService);
  private cryptoService = inject(CryptoService);
  private authService = inject(AuthService);
  private gamificationService = inject(GamificationService);

  private entriesSignal = signal<DiaryEntry[]>([]);
  public entries = this.entriesSignal.asReadonly();

  constructor() {
    this.loadEntries();
  }

  async loadEntries() {
    const user = this.authService.currentUser();
    if (!user) return;

    const { data, error } = await this.supabaseService.supabase
      .from('diary_entries')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });

    if (data && !error) {
      const parsedEntries = data.map(row => ({
        id: row.id,
        date: row.created_at,
        content: this.cryptoService.decrypt(row.content), // Desciframos el contenido
        moods: row.moods || [],
        sleepHours: row.sleep_hours || null,
        highRisk: row.high_risk
      }));
      this.entriesSignal.set(parsedEntries);
    }
  }

  async saveEntry(content: string, moods: string[], sleepHours: number | null = null) {
    const user = this.authService.currentUser();
    if (!user) return;

    // Detectar riesgo antes de cifrar (Mock del Core de IA)
    const lowerContent = content.toLowerCase();
    const highRiskWords = ['morir', 'suicidio', 'no vale la pena', 'acabar con todo', 'no quiero vivir'];
    const isHighRisk = highRiskWords.some(word => lowerContent.includes(word));

    // Cifrar el contenido para Privacidad Zero-Knowledge
    const encryptedContent = this.cryptoService.encrypt(content);

    const { data, error } = await this.supabaseService.supabase
      .from('diary_entries')
      .insert({
        student_id: user.id,
        content: encryptedContent,
        moods: moods,
        sleep_hours: sleepHours,
        high_risk: isHighRisk
      })
      .select()
      .single();

    if (data && !error) {
      // Registrar actividad de gamificación
      this.gamificationService.registerActivity('diary').then(res => {
        if (res && res.unlocked_achievements && res.unlocked_achievements.length > 0) {
          console.log('🏆 ¡Logros desbloqueados!', res.unlocked_achievements);
        }
      });

      const newEntry: DiaryEntry = {
        id: data.id,
        date: data.created_at,
        content: content, // Mantenemos el texto plano en la UI actual
        moods: data.moods,
        sleepHours: data.sleep_hours || sleepHours,
        highRisk: data.high_risk
      };
      
      this.entriesSignal.update(entries => [newEntry, ...entries]);

      if (isHighRisk) {
        console.warn('ALERTA CLÍNICA: Entrada marcada con alto riesgo.');
      }
    }
  }
}
