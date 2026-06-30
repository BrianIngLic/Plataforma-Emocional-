import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { GamificationService } from '../../../core/services/gamification.service';

@Component({
  selector: 'app-streak-badge',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterModule],
  template: `
    <div class="streak-badge-container" 
         [routerLink]="['/dashboard/achievements']" 
         [class.active]="streakCount() > 0"
         title="Tu Racha de Actividad. ¡Haz clic para ver tus logros!">
      <mat-icon class="flame-icon">local_fire_department</mat-icon>
      <span class="streak-number">{{ streakCount() }}</span>
    </div>
  `,
  styles: [`
    .streak-badge-container {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 12px;
      background: rgba(148, 163, 184, 0.1); // Muted slate bg
      color: #94a3b8;
      font-weight: 800;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.3s ease;
      border: 1px solid rgba(148, 163, 184, 0.15);
      user-select: none;

      .flame-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        transition: transform 0.3s ease;
      }

      &:hover {
        transform: translateY(-2px);
        background: rgba(148, 163, 184, 0.15);
        
        .flame-icon {
          transform: scale(1.15);
        }
      }

      &.active {
        background: linear-gradient(135deg, rgba(254, 243, 199, 0.9) 0%, rgba(254, 215, 170, 0.9) 100%);
        color: #ea580c; // Naranja fuego
        border-color: rgba(253, 230, 138, 0.8);
        box-shadow: 0 4px 10px rgba(234, 88, 12, 0.15);

        .flame-icon {
          color: #ea580c;
          animation: badgeFlamePulse 2s infinite;
        }

        &:hover {
          background: linear-gradient(135deg, rgba(254, 243, 199, 1) 0%, rgba(254, 215, 170, 1) 100%);
          box-shadow: 0 6px 15px rgba(234, 88, 12, 0.25);
        }
      }
    }

    @keyframes badgeFlamePulse {
      0% { transform: scale(1); filter: drop-shadow(0 0 1px rgba(234,88,12,0.3)); }
      50% { transform: scale(1.15); filter: drop-shadow(0 0 4px rgba(234,88,12,0.6)); }
      100% { transform: scale(1); filter: drop-shadow(0 0 1px rgba(234,88,12,0.3)); }
    }
  `]
})
export class StreakBadgeComponent {
  private gamificationService = inject(GamificationService);
  public streakCount = this.gamificationService.currentStreak;
}
