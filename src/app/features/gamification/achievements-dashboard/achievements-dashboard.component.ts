import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { GamificationService, Achievement } from '../../../core/services/gamification.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-achievements-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressBarModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="achievements-layout">
      <!-- Cabecera de Experiencia y Racha (Glassmorphism) -->
      <div class="header-banner glass-card">
        <div class="streak-section">
          <div class="streak-icon-wrapper pulse-flame" [class.active]="streakDays() > 0">
            <mat-icon class="flame-icon">local_fire_department</mat-icon>
          </div>
          <div class="streak-info">
            <h2>{{ streakDays() }} Días de Racha</h2>
            <span class="subtitle">
              {{ streakDays() > 0 ? '¡Estás encendido! Sigue registrando hoy.' : 'Registra tus emociones hoy para iniciar tu racha.' }}
            </span>
          </div>
        </div>
        
        <div class="xp-section">
          <div class="xp-info">
            <span class="level-title">Nivel {{ currentLevel() }}: {{ getLevelTitle() }}</span>
            <span class="xp-count">{{ totalXp() }} XP Totales ({{ xpInCurrentLevel() }} / 500 para Nivel {{ currentLevel() + 1 }})</span>
          </div>
          <mat-progress-bar mode="determinate" [value]="xpProgress()"></mat-progress-bar>
        </div>
      </div>

      <!-- Categorías de Filtrado rápido -->
      <div class="category-filters">
        <button mat-stroked-button [class.active]="selectedCategory() === 'all'" (click)="selectCategory('all')">Todos</button>
        <button mat-stroked-button [class.active]="selectedCategory() === 'diary'" (click)="selectCategory('diary')">Diario</button>
        <button mat-stroked-button [class.active]="selectedCategory() === 'streak'" (click)="selectCategory('streak')">Rachas</button>
        <button mat-stroked-button [class.active]="selectedCategory() === 'nutrition'" (click)="selectCategory('nutrition')">Nutrición</button>
        <button mat-stroked-button [class.active]="selectedCategory() === 'amati'" (click)="selectCategory('amati')">Amati IA</button>
        <button mat-stroked-button [class.active]="selectedCategory() === 'clinical'" (click)="selectCategory('clinical')">Clínicos</button>
      </div>

      <!-- Sección de Metas Activas (Logros en Progreso) -->
      <div class="section-title">
        <h3>Medallas y Logros de Bienestar</h3>
      </div>

      <!-- Grid de Logros -->
      <div class="achievements-grid">
        <div *ngFor="let item of filteredAchievements()" 
             class="achievement-card glass-card" 
             [class.unlocked]="item.is_completed">
          
          <!-- Icono / Medalla del Logro -->
          <div class="card-icon" [style.background]="getBadgeBg(item)">
            <mat-icon [style.color]="getBadgeColor(item)">{{ getBadgeIcon(item) }}</mat-icon>
            <div class="lock-overlay" *ngIf="!item.is_completed">
              <mat-icon class="lock-icon">lock</mat-icon>
            </div>
          </div>

          <!-- Contenido del Logro -->
          <div class="card-content">
            <div class="title-row">
              <h4 class="title">{{ item.title }}</h4>
              <span class="xp-badge" [class.unlocked]="item.is_completed">+{{ item.points }} XP</span>
            </div>
            
            <p class="description">{{ item.description }}</p>
            
            <!-- Barra de progreso parcial (Si está bloqueado) -->
            <div class="progress-area" *ngIf="!item.is_completed && item.criteria_value > 1">
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" [style.width.%]="(item.progress / item.criteria_value) * 100"></div>
              </div>
              <span class="progress-text">{{ item.progress }} / {{ item.criteria_value }}</span>
            </div>

            <!-- Estampa de desbloqueo (Si está completado) -->
            <div class="unlock-stamp" *ngIf="item.is_completed">
              <mat-icon class="check-icon">verified</mat-icon>
              <span>Desbloqueado{{ item.earned_at ? ' el ' + (item.earned_at | date:'dd MMM, yyyy') : '' }}</span>
            </div>

            <!-- Notas del especialista (Para logros clínicos manuales) -->
            <div class="clinical-notes" *ngIf="item.criteria_type === 'clinical' && item.notes">
              <mat-icon class="notes-icon">chat_bubble_outline</mat-icon>
              <span>"{{ item.notes }}"</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styleUrls: ['./achievements-dashboard.component.scss']
})
export class AchievementsDashboardComponent implements OnInit {
  private gamificationService = inject(GamificationService);
  private authService = inject(AuthService);

  // Signals para coordinar la UI
  selectedCategory = signal<string>('all');
  streakDays = this.gamificationService.currentStreak;
  totalXp = this.gamificationService.totalXp;
  achievements = this.gamificationService.achievementsList;

  // Lógica de Niveles (Nivel cada 500 XP)
  currentLevel = computed(() => Math.floor(this.totalXp() / 500) + 1);
  xpInCurrentLevel = computed(() => this.totalXp() % 500);
  xpProgress = computed(() => (this.xpInCurrentLevel() / 500) * 100);

  // Filtrado de logros basado en la categoría seleccionada
  filteredAchievements = computed(() => {
    const cat = this.selectedCategory();
    const list = this.achievements();
    if (cat === 'all') return list;
    if (cat === 'clinical') return list.filter(a => a.criteria_type === 'clinical');
    return list.filter(a => a.criteria_type === cat);
  });

  async ngOnInit() {
    await this.gamificationService.loadGamificationData();
  }

  selectCategory(category: string) {
    this.selectedCategory.set(category);
  }

  getLevelTitle(): string {
    const lvl = this.currentLevel();
    if (lvl <= 1) return 'Iniciado Emocional';
    if (lvl <= 3) return 'Buscador de Calma';
    if (lvl <= 5) return 'Explorador Emocional';
    if (lvl <= 7) return 'Guerrero de la Constancia';
    return 'Maestro del Bienestar';
  }

  getBadgeIcon(item: Achievement): string {
    if (item.criteria_type === 'clinical') return 'military_tech';
    switch (item.criteria_type) {
      case 'diary': return 'auto_stories';
      case 'streak': return 'local_fire_department';
      case 'nutrition': return 'restaurant';
      case 'amati': return 'smart_toy';
      case 'appointment': return 'event_available';
      default: return 'workspace_premium';
    }
  }

  getBadgeColor(item: Achievement): string {
    if (!item.is_completed) return '#94a3b8'; // Slate 400
    if (item.criteria_type === 'clinical') return '#d97706'; // Ambar
    switch (item.criteria_type) {
      case 'diary': return '#8b5cf6'; // Violeta
      case 'streak': return '#ef4444'; // Rojo fuego
      case 'nutrition': return '#10b981'; // Esmeralda
      case 'amati': return '#06b6d4'; // Cian
      case 'appointment': return '#3b82f6'; // Azul
      default: return '#f59e0b';
    }
  }

  getBadgeBg(item: Achievement): string {
    if (!item.is_completed) return '#f1f5f9';
    if (item.criteria_type === 'clinical') return 'rgba(217, 119, 6, 0.15)';
    switch (item.criteria_type) {
      case 'diary': return 'rgba(139, 92, 246, 0.15)';
      case 'streak': return 'rgba(239, 68, 68, 0.15)';
      case 'nutrition': return 'rgba(16, 185, 129, 0.15)';
      case 'amati': return 'rgba(6, 182, 212, 0.15)';
      case 'appointment': return 'rgba(59, 130, 246, 0.15)';
      default: return 'rgba(245, 158, 11, 0.15)';
    }
  }
}
