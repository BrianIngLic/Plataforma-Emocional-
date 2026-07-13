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

      // 2. Obtener logros del catálogo
      // Se usa select('*') porque los nombres de columna exactos dependen del schema en Supabase
      const { data: globalAchievements, error: globalErr } = await this.supabase
        .from('achievements')
        .select('*');

      if (globalErr) {
        console.error('[GamificationService] Error cargando achievements:', globalErr.message);
        this.achievementsList.set([]);
        return;
      }

      const { data: userUnlocked, error: unlockedErr } = await this.supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', user.id);

      if (unlockedErr) {
        console.error('[GamificationService] Error cargando user_achievements:', unlockedErr.message);
        this.achievementsList.set([]);
        return;
      }

      const unlockedMap = new Map<string, any>();
      (userUnlocked ?? []).forEach((ua: any) => {
        unlockedMap.set(ua.achievement_id, ua);
      });

      const list: Achievement[] = (globalAchievements ?? []).map((ach: any) => {
        const ua = unlockedMap.get(ach.id);
        // Compatibilidad con ambos schemas:
        // Schema viejo: solo tiene unlocked_at
        // Schema nuevo: tiene is_completed, earned_at, progress, notes
        const isCompleted = ua
          ? (ua.is_completed !== undefined ? ua.is_completed : !!ua.unlocked_at)
          : false;
        const earnedAt = ua
          ? (ua.earned_at || ua.unlocked_at || null)
          : null;
        return {
          id:             ach.id              || '',
          title:         ach.title            || 'Logro',
          description:   ach.description      || '',
          points:        ach.xp_value         ?? 0,
          badge_url:     ach.badge_image_url  || 'medal',
          criteria_type: ach.requirement_type || 'general',
          criteria_value: ach.requirement_value ?? 1,
          progress:      ua ? (ua.progress ?? (isCompleted ? 1 : 0)) : 0,
          is_completed:  isCompleted,
          earned_at:     earnedAt,
          notes:         ua ? ua.notes        : null
        };
      });

      this.achievementsList.set(list);
    } catch (err) {
      console.error('❌ Error al cargar datos de gamificación:', err);
    }
  }

  /**
   * Muestra un toast premium y animado en pantalla al cumplir un logro.
   */
  private showAchievementToast(title: string, xpReward: number) {
    let container = document.getElementById('achievement-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'achievement-toast-container';
      container.className = 'achievement-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
      <div class="toast-icon-wrapper">🏆</div>
      <div class="toast-body">
        <div class="toast-subtitle">¡Logro Desbloqueado!</div>
        <h4 class="toast-title">${title}</h4>
        <div class="toast-xp">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 2px;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <span>+${xpReward} XP</span>
        </div>
      </div>
    `;

    container.appendChild(toast);

    // Activar animación de entrada
    setTimeout(() => toast.classList.add('active'), 50);

    // Remover automáticamente después de 5 segundos
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        toast.remove();
        if (container && container.childNodes.length === 0) {
          container.remove();
        }
      }, 500);
    }, 5000);
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

      // Si hay logros recién desbloqueados, mostrar notificaciones
      if (data && data.unlocked_achievements && Array.isArray(data.unlocked_achievements)) {
        data.unlocked_achievements.forEach((ach: any) => {
          const xp = ach.xp_value || ach.xp_reward || 10;
          this.showAchievementToast(ach.title, xp);
        });
      }

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

      // 2. Crear el logro en el catálogo con los nombres de columna correctos
      const { data: newAch, error: achErr } = await this.supabase
        .from('achievements')
        .insert({
          category_id:       category.id,
          title:             title,
          description:       description,
          xp_value:          points,
          badge_image_url:   iconName || 'verified',
          requirement_type:  'clinical',
          requirement_value: 1,
          creator_role:      professional.role === 'Admin' ? 1 : (professional.role === 'Psicologo' ? 3 : 4),
          creator_id:        professional.id
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
          unlocked_at: new Date().toISOString(),
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
            user_id:            studentId,
            current_streak:     0,
            best_streak:        0,
            last_activity_date: new Date().toISOString().split('T')[0],
            total_xp:           points
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
      .select('id, title, description, xp_value, badge_image_url, requirement_type, requirement_value, creator_id, creator_role')
      .eq('creator_role', 1);
    if (error) {
      console.error('[GamificationService] Error cargando catálogo global:', error.message);
      return [];
    }
    return data ?? [];
  }
}
