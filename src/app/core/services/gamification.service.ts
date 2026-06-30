import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

export interface UserStreak {
  user_id: string;
  current_streak: number;
  best_streak: number;
  last_activity_date: string;
  total_xp: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  points: number;
  badge_url: string;
  criteria_type: string;
  criteria_value: number;
  progress: number;
  is_completed: boolean;
  earned_at?: string | null;
  notes?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class GamificationService {
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);

  private supabase = this.supabaseService.supabase;

  // Reactividad mediante Angular Signals
  public currentStreak = signal<number>(0);
  public bestStreak = signal<number>(0);
  public totalXp = signal<number>(0);
  public achievementsList = signal<Achievement[]>([]);

  constructor() {
    // Sincronizar datos automáticamente cuando el usuario inicie sesión
    this.authService.currentUser;
  }

  /**
   * Carga los datos de racha, XP y logros del usuario actual
   */
  async loadGamificationData() {
    const user = this.authService.currentUser();
    if (!user?.id) return;

    try {
      // 1. Obtener la racha y XP
      const { data: streakData, error: streakErr } = await this.supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!streakErr && streakData) {
        this.currentStreak.set(streakData.current_streak);
        this.bestStreak.set(streakData.best_streak);
        this.totalXp.set(streakData.total_xp);
      } else {
        // Inicializar racha por defecto en memoria
        this.currentStreak.set(0);
        this.bestStreak.set(0);
        this.totalXp.set(0);
      }

      // 2. Obtener logros del catálogo y cruzarlos con el progreso/desbloqueo del alumno
      const { data: globalAchievements, error: globalErr } = await this.supabase
        .from('achievements')
        .select('*, category:achievement_categories(name)')
        .eq('is_active', true);

      if (globalErr) throw globalErr;

      const { data: userUnlocked, error: unlockedErr } = await this.supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', user.id);

      if (unlockedErr) throw unlockedErr;

      const unlockedMap = new Map<string, any>();
      (userUnlocked ?? []).forEach((ua: any) => {
        unlockedMap.set(ua.achievement_id, ua);
      });

      const list: Achievement[] = (globalAchievements ?? []).map((ach: any) => {
        const ua = unlockedMap.get(ach.id);
        return {
          id: ach.id,
          title: ach.title,
          description: ach.description,
          points: ach.points,
          badge_url: ach.badge_url || 'medal',
          criteria_type: ach.criteria_type,
          criteria_value: ach.criteria_value,
          progress: ua ? ua.progress : 0,
          is_completed: ua ? ua.is_completed : false,
          earned_at: ua ? ua.earned_at : null,
          notes: ua ? ua.notes : null
        };
      });

      this.achievementsList.set(list);
    } catch (err) {
      console.error('❌ Error al cargar datos de gamificación:', err);
    }
  }

  /**
   * Registra una actividad del estudiante (diario, alimentación, amati, cita) 
   * invocando el motor de rachas en base de datos.
   */
  async registerActivity(category: 'diary' | 'nutrition' | 'amati' | 'appointment'): Promise<any> {
    const user = this.authService.currentUser();
    if (!user?.id) return null;

    try {
      console.log(`🎮 [Gamification]: Registrando actividad '${category}' para el usuario ${user.id}`);
      
      const { data, error } = await this.supabase.rpc('update_user_activity_streak', {
        p_user_id: user.id,
        p_category: category
      });

      if (error) throw error;

      // Recargar datos para actualizar la UI reactivamente
      await this.loadGamificationData();

      // Devolver logros desbloqueados en esta interacción para alertas visuales
      return data;
    } catch (err) {
      console.error('❌ Error registrando actividad gamificada:', err);
      return null;
    }
  }

  /**
   * Permite al especialista (psicólogo/nutriólogo) o administrador asignar un logro clínico manual
   * o crear un logro personalizado en caliente para un estudiante.
   */
  async awardClinicalAchievement(
    studentId: string,
    title: string,
    description: string,
    points: number,
    iconName: string,
    notes: string
  ): Promise<boolean> {
    const professional = this.authService.currentUser();
    if (!professional?.id) return false;

    try {
      // 1. Obtener la categoría "Clínicos"
      const { data: category } = await this.supabase
        .from('achievement_categories')
        .select('id')
        .eq('name', 'Clínicos')
        .maybeSingle();

      if (!category) {
        throw new Error('Categoría de logros "Clínicos" no encontrada.');
      }

      // 2. Crear el logro en el catálogo (asociado al creador)
      const { data: newAch, error: achErr } = await this.supabase
        .from('achievements')
        .insert({
          category_id: category.id,
          title: title,
          description: description,
          points: points,
          badge_url: iconName || 'verified',
          criteria_type: 'clinical',
          criteria_value: 1,
          is_active: true,
          creator_role: professional.role === 'Admin' ? 1 : (professional.role === 'Psicologo' ? 3 : 4),
          creator_id: professional.id
        })
        .select()
        .single();

      if (achErr || !newAch) throw achErr;

      // 3. Asignar el logro de inmediato al estudiante como desbloqueado
      const { error: linkErr } = await this.supabase
        .from('user_achievements')
        .insert({
          user_id: studentId,
          achievement_id: newAch.id,
          progress: 1,
          is_completed: true,
          earned_at: new Date().toISOString(),
          awarded_by: professional.id,
          notes: notes
        });

      if (linkErr) throw linkErr;

      // 4. Sumar los puntos al total_xp del estudiante en user_streaks
      const { data: userStreak } = await this.supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', studentId)
        .maybeSingle();

      if (userStreak) {
        await this.supabase
          .from('user_streaks')
          .update({ total_xp: userStreak.total_xp + points })
          .eq('user_id', studentId);
      } else {
        await this.supabase
          .from('user_streaks')
          .insert({
            user_id: studentId,
            current_streak: 0,
            best_streak: 0,
            last_activity_date: new Date().toISOString().split('T')[0],
            total_xp: points
          });
      }

      console.log(`🏆 [Logro Asignado]: Se otorgó el logro "${title}" (+${points} XP) al alumno ${studentId}`);
      return true;
    } catch (err) {
      console.error('❌ Error asignando logro clínico:', err);
      return false;
    }
  }

  /**
   * Obtiene la lista de logros del catálogo creados por el administrador
   */
  async getGlobalCatalogAchievements(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('achievements')
      .select('*, creator:users!creator_id(profiles(first_name, last_name))')
      .eq('creator_role', 1)
      .eq('is_active', true);
    return error ? [] : (data ?? []);
  }
}
