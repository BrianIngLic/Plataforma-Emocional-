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

/** Entrada del Diario Alimentario Personal del estudiante */
export interface FoodDiaryEntry {
  id: string;
  diary_date: string;
  meal_time: string;       // "HH:MM"
  mood_before: string;     // emoji + label, ej. "😊 Bien"
  what_i_ate: string;      // HTML enriquecido (Quill)
  mood_after: string;      // emoji + label
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class DiaryService {
  private supabaseService = inject(SupabaseService);
  private cryptoService   = inject(CryptoService);
  private authService     = inject(AuthService);
  private gamificationService = inject(GamificationService);

  // ─── Diario Emocional ────────────────────────────────────────────────
  private entriesSignal = signal<DiaryEntry[]>([]);
  public entries = this.entriesSignal.asReadonly();

  // ─── Diario Alimentario ──────────────────────────────────────────────
  private foodEntriesSignal = signal<FoodDiaryEntry[]>([]);
  public foodEntries = this.foodEntriesSignal.asReadonly();

  /** Fecha activa del diario (hoy por defecto) */
  public activeDate = signal<string>(new Date().toISOString().split('T')[0]);

  constructor() {
    this.loadEntries();
    this.loadFoodEntries();
  }

  // ════════════════════════════════════════════════════════════════════
  // DIARIO EMOCIONAL
  // ════════════════════════════════════════════════════════════════════

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
        content: this.cryptoService.decrypt(row.content),
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

    const lowerContent = content.toLowerCase();
    const highRiskWords = ['morir', 'suicidio', 'no vale la pena', 'acabar con todo', 'no quiero vivir'];
    const isHighRisk = highRiskWords.some(word => lowerContent.includes(word));

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
      this.gamificationService.registerActivity('diary').then(res => {
        if (res?.unlocked_achievements?.length > 0) {
          console.log('🏆 ¡Logros desbloqueados!', res.unlocked_achievements);
        }
      });

      const newEntry: DiaryEntry = {
        id: data.id,
        date: data.created_at,
        content: content,
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

   async updateEntry(id: string, content: string, moods: string[], sleepHours: number | null = null) {
     const user = this.authService.currentUser();
     if (!user) return;

     const lowerContent = content.toLowerCase();
     const highRiskWords = ['morir', 'suicidio', 'no vale la pena', 'acabar con todo', 'no quiero vivir'];
     const isHighRisk = highRiskWords.some(word => lowerContent.includes(word));

     const encryptedContent = this.cryptoService.encrypt(content);

     const { data, error } = await this.supabaseService.supabase
       .from('diary_entries')
       .update({
         content: encryptedContent,
         moods: moods,
         sleep_hours: sleepHours,
         high_risk: isHighRisk
       })
       .eq('id', id)
       .eq('student_id', user.id)
       .select()
       .single();

     if (error) {
       console.error('[DiaryService] Error actualizando entrada del diario:', error.message);
       return;
     }

     // Actualizar la señal reactiva con el contenido plano (descifrado) en memoria
     this.entriesSignal.update(entries =>
       entries.map(e => e.id === id ? {
         ...e,
         content: content,
         moods: moods,
         sleepHours: sleepHours,
         highRisk: isHighRisk
       } : e)
     );
   }

  // ════════════════════════════════════════════════════════════════════
  // DIARIO ALIMENTARIO
  // ════════════════════════════════════════════════════════════════════

  async loadFoodEntries(date?: string) {
    const user = this.authService.currentUser();
    if (!user) return;

    const targetDate = date ?? this.activeDate();

    const { data, error } = await this.supabaseService.supabase
      .from('food_diary_entries')
      .select('*')
      .eq('student_id', user.id)
      .eq('diary_date', targetDate)
      .order('meal_time', { ascending: true });

    if (data && !error) {
      this.foodEntriesSignal.set(data.map(row => {
        let decryptedWhat = '';
        try {
          decryptedWhat = this.cryptoService.decrypt(row.what_i_ate);
        } catch (e) {
          decryptedWhat = row.what_i_ate; // Fallback si no está cifrado
        }
        return {
          id: row.id,
          diary_date: row.diary_date,
          meal_time: row.meal_time,
          mood_before: row.mood_before,
          what_i_ate: decryptedWhat,
          mood_after: row.mood_after,
          created_at: row.created_at
        };
      }));
    } else if (error) {
      console.error('Error cargando entradas alimentarias:', error.message);
    }
  }

  async saveFoodEntry(entry: Omit<FoodDiaryEntry, 'id' | 'created_at'>) {
    const user = this.authService.currentUser();
    if (!user) return null;

    const encryptedWhat = this.cryptoService.encrypt(entry.what_i_ate);

    const { data, error } = await this.supabaseService.supabase
      .from('food_diary_entries')
      .insert({
        student_id: user.id,
        diary_date: entry.diary_date,
        meal_time: entry.meal_time,
        mood_before: entry.mood_before,
        what_i_ate: encryptedWhat,
        mood_after: entry.mood_after
      })
      .select()
      .single();

    if (data && !error) {
      const newEntry: FoodDiaryEntry = {
        id: data.id,
        diary_date: data.diary_date,
        meal_time: data.meal_time,
        mood_before: data.mood_before,
        what_i_ate: entry.what_i_ate, // Conservar plano en memoria para la interfaz
        mood_after: data.mood_after,
        created_at: data.created_at
      };
      // Insertar ordenado por hora y actualizar señal reactiva
      this.foodEntriesSignal.update(entries =>
        [...entries, newEntry].sort((a, b) => a.meal_time.localeCompare(b.meal_time))
      );

      // Registrar la actividad de nutrición para los logros
      this.gamificationService.registerActivity('nutrition').then(res => {
        if (res?.unlocked_achievements?.length > 0) {
          console.log('🏆 ¡Logros desbloqueados (Nutrición)!', res.unlocked_achievements);
        }
      });

      return newEntry;
    } else {
      console.error('Error guardando entrada alimentaria:', error?.message);
      return null;
    }
  }

  async updateFoodEntry(id: string, patch: Partial<Pick<FoodDiaryEntry, 'meal_time' | 'mood_before' | 'what_i_ate' | 'mood_after'>>) {
    const patchCopy = { ...patch };
    if (patchCopy.what_i_ate !== undefined) {
      patchCopy.what_i_ate = this.cryptoService.encrypt(patchCopy.what_i_ate);
    }

    const { error } = await this.supabaseService.supabase
      .from('food_diary_entries')
      .update({ ...patchCopy, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      this.foodEntriesSignal.update(entries =>
        entries
          .map(e => e.id === id ? { ...e, ...patch } : e) // Mantener plano en memoria
          .sort((a, b) => a.meal_time.localeCompare(b.meal_time))
      );
      return true;
    }
    console.error('Error actualizando entrada alimentaria:', error?.message);
    return false;
  }

  async deleteFoodEntry(id: string) {
    const { error } = await this.supabaseService.supabase
      .from('food_diary_entries')
      .delete()
      .eq('id', id);

    if (!error) {
      this.foodEntriesSignal.update(entries => entries.filter(e => e.id !== id));
      return true;
    }
    console.error('Error eliminando entrada alimentaria:', error?.message);
    return false;
  }

  /** Utilidad: convierte HTML enriquecido a texto plano para previsualizaciones */
  stripHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
