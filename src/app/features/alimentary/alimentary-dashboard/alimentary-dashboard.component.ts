import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClinicalService } from '../../../core/services/clinical.service';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  isTyping?: boolean;
  isEditing?: boolean;
  options?: string[];
  questionId?: string;
}

@Component({
  selector: 'app-alimentary-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="dashboard-container" [ngClass]="{'chat-mode': !loading && !isUnlocked}">
      <div *ngIf="loading" class="amati-loading-container">
        <div class="amati-loader-wrapper">
          <div class="spinner-ring"></div>
          <img src="/amati-logo.svg" alt="Amati Logo" class="amati-logo-pulse" />
        </div>
        <h3 class="loading-title">Verificando expediente...</h3>
        <p class="loading-subtitle">Analizando métricas nutricionales y correlación emocional</p>
      </div>

      <!-- ESTADO 1: DESBLOQUEADO (MÓDULO PRINCIPAL) -->
      <ng-container *ngIf="!loading && isUnlocked">
        <div class="unlocked-content" style="padding: 1.5rem; max-width: 1000px; margin: 0 auto;">
          <div class="unlocked-header" style="margin-bottom: 2rem;">
            <div class="header-icon">
              <mat-icon>restaurant</mat-icon>
            </div>
            <div class="header-text">
              <h1>Módulo Alimentario</h1>
              <p>Espacio personal de nutrición y bienestar.</p>
            </div>
          </div>

          <!-- Recordatorio de 24 Horas -->
          <div class="glass-card recall-card" style="margin-bottom: 2rem; border: 1px solid var(--border-color); border-radius: 16px; padding: 1.75rem; background: var(--bg-card);">
            <div class="card-header" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
              <mat-icon style="color: #10b981; font-size: 28px; width: 28px; height: 28px;">restaurant_menu</mat-icon>
              <div>
                <h2 style="margin: 0; font-size: 1.35rem; color: var(--text-primary);">Recordatorio de 24 Horas</h2>
                <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">Registra tus consumos diarios de alimentos y calorías estimadas.</p>
              </div>
            </div>

            <!-- Selector de Días -->
            <div class="days-selector-bar" style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 1rem; margin-bottom: 1.5rem;">
              <button *ngFor="let d of availableDates" 
                      (click)="selectRecallDate(d.dateStr)" 
                      [class.active]="selectedDateStr === d.dateStr"
                      class="day-selector-btn"
                      style="padding: 0.6rem 1rem; border-radius: 12px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-primary); cursor: pointer; transition: all 0.25s; font-weight: 500; font-size: 0.85rem; white-space: nowrap; display: flex; flex-direction: column; align-items: center;">
                <span class="day-lbl" style="font-size: 0.85rem;">{{ d.label }}</span>
                <span class="day-date" style="font-size: 0.7rem; opacity: 0.7; margin-top: 2px;">{{ d.dateStr.substring(8, 10) }}/{{ d.dateStr.substring(5, 7) }}</span>
              </button>
            </div>

            <!-- Formulario de Comidas -->
            <div class="recall-form" style="display: grid; grid-template-columns: 1fr; gap: 1.25rem;">
              <div class="form-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
                <div class="form-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
                  <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Desayuno</label>
                  <textarea [(ngModel)]="currentRecall.desayuno" placeholder="¿Qué desayunaste hoy? (Ej. Huevo revuelto, avena, fruta)" rows="2" style="padding: 0.75rem; border-radius: 10px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-primary); font-size: 0.9rem; resize: none; outline: none;"></textarea>
                </div>

                <div class="form-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
                  <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Colación 1 (Mañana)</label>
                  <textarea [(ngModel)]="currentRecall.colacion1" placeholder="Ej. Almendras, manzana, yogurt" rows="2" style="padding: 0.75rem; border-radius: 10px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-primary); font-size: 0.9rem; resize: none; outline: none;"></textarea>
                </div>

                <div class="form-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
                  <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Comida</label>
                  <textarea [(ngModel)]="currentRecall.comida" placeholder="¿Qué comiste? (Ej. Pechuga de pollo, arroz, verduras)" rows="2" style="padding: 0.75rem; border-radius: 10px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-primary); font-size: 0.9rem; resize: none; outline: none;"></textarea>
                </div>

                <div class="form-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
                  <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Colación 2 (Tarde)</label>
                  <textarea [(ngModel)]="currentRecall.colacion2" placeholder="Ej. Barra de cereal, jícama picada" rows="2" style="padding: 0.75rem; border-radius: 10px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-primary); font-size: 0.9rem; resize: none; outline: none;"></textarea>
                </div>

                <div class="form-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
                  <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Cena</label>
                  <textarea [(ngModel)]="currentRecall.cena" placeholder="¿Qué cenaste? (Ej. Licuado, quesadillas, ensalada)" rows="2" style="padding: 0.75rem; border-radius: 10px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-primary); font-size: 0.9rem; resize: none; outline: none;"></textarea>
                </div>

                <div class="form-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
                  <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Calorías Totales (Est.)</label>
                  <input [(ngModel)]="currentRecall.calorias_totales" type="number" placeholder="Ej. 1800" style="padding: 0.75rem; border-radius: 10px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-primary); font-size: 0.9rem; outline: none;" />
                </div>
              </div>

              <div class="form-actions" style="display: flex; justify-content: flex-end; margin-top: 1rem;">
                <button (click)="saveRecall()" 
                        [disabled]="isSavingRecall"
                        style="display: inline-flex; align-items: center; gap: 0.5rem; background: #10b981; color: white; border: none; padding: 0.75rem 1.75rem; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                  <mat-icon style="font-size: 20px; width: 20px; height: 20px;">save</mat-icon>
                  {{ isSavingRecall ? 'Guardando...' : 'Guardar Recordatorio' }}
                </button>
              </div>
            </div>
          </div>

          <div class="placeholder-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
            <div class="glass-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 1.5rem; text-align: center;">
              <mat-icon style="font-size: 40px; width: 40px; height: 40px; color: #10b981; margin-bottom: 0.75rem;">insights</mat-icon>
              <h3 style="margin: 0 0 0.5rem; color: var(--text-primary);">Tus Resultados EAT-26</h3>
              <p style="margin: 0; color: var(--text-secondary); line-height: 1.5; font-size: 0.9rem;">Tu cuestionario inicial ha sido anexado de manera encriptada y segura a tu expediente clínico.</p>
            </div>
            <div class="glass-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 1.5rem; text-align: center;">
              <mat-icon style="font-size: 40px; width: 40px; height: 40px; color: #3b82f6; margin-bottom: 0.75rem;">spa</mat-icon>
              <h3 style="margin: 0 0 0.5rem; color: var(--text-primary);">Salud Nutricional</h3>
              <p style="margin: 0; color: var(--text-secondary); line-height: 1.5; font-size: 0.9rem;">Mantén el contacto con tu nutricionista asignado para ajustar tus metas corporales y menús.</p>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ESTADO 2: BLOQUEADO (CHAT INTERACTIVO) -->
      <ng-container *ngIf="!loading && !isUnlocked">
        <div class="chat-container">
          
          <div class="chat-header">
            <div class="avatar"><mat-icon>smart_toy</mat-icon></div>
            <div class="info">
              <h2>Amati Clínico</h2>
              <p>Desbloqueo de Módulo Alimentario</p>
            </div>
            <div class="hybrid-progress-container">
              <div class="water-bar">
                <div class="water-fill" [style.width.%]="getProgressRatio() * 100"></div>
                <div class="dolphin-wrapper" [class.jumping]="isJumping" [style.left.%]="getProgressRatio() * 100">
                  <div class="dolphin-bob">
                    <div class="dolphin-emoji">🐬</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="chat-messages" #scrollMe>
            <div class="message-wrapper" *ngFor="let msg of messages" [ngClass]="msg.sender">
              <div class="message-bubble" 
                   [title]="msg.sender === 'user' ? 'Doble clic para corregir respuesta' : ''"
                   (dblclick)="editAnswer(msg)">
                <ng-container *ngIf="!msg.isTyping && !msg.isEditing">{{ msg.text }}</ng-container>
                
                <div class="typing-dots" *ngIf="msg.isTyping">
                  <span></span><span></span><span></span>
                </div>

                <div class="edit-options" *ngIf="msg.isEditing">
                  <span class="edit-hint">Corrigiendo respuesta:</span>
                  <div class="mini-options">
                    <button *ngFor="let opt of msg.options" 
                            [class.active]="msg.text === opt"
                            (click)="saveEdit(msg, opt); $event.stopPropagation()">
                      {{ opt }}
                    </button>
                  </div>
                  <button class="cancel-edit" (click)="msg.isEditing = false; $event.stopPropagation()">Cancelar</button>
                </div>
              </div>
            </div>
          </div>

          <div class="chat-input-area" *ngIf="!quizFinished && !isAiTyping">
            <p class="quick-reply-label">Selecciona una respuesta:</p>
            <div class="quick-replies">
              <button class="reply-btn" *ngFor="let opt of currentQuestion.options" (click)="selectOption(opt)">
                {{ opt }}
              </button>
            </div>
          </div>

        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      flex: 1 1 auto;
      height: 100%;
      min-height: 0;
    }

    .dashboard-container {
      min-height: 100%;
      height: 100%;
      overflow-y: auto;
      
      &.chat-mode {
        padding: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
    }
    
    .loading-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50vh; color: var(--text-secondary);
      mat-spinner { margin-bottom: 1rem; }
    }

    /* Módulo Desbloqueado */
    .unlocked-header {
      display: flex; align-items: center; gap: 1.5rem;
      .header-icon {
        width: 56px; height: 56px; border-radius: 14px; background: rgba(16, 185, 129, 0.1); color: #10b981;
        display: flex; align-items: center; justify-content: center;
        mat-icon { font-size: 28px; width: 28px; height: 28px; }
      }
      .header-text {
        h1 { margin: 0; font-size: 1.75rem; color: var(--text-primary); }
        p { margin: 0.25rem 0 0; color: var(--text-secondary); font-size: 0.95rem; }
      }
    }

    .day-selector-btn.active {
      background: #10b981 !important;
      color: white !important;
      border-color: #10b981 !important;
      box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);
    }
    
    .day-selector-btn:hover {
      border-color: #10b981 !important;
    }

    /* Chat Interactivo */
    .chat-container {
      width: 100%; flex: 1; background: var(--bg-card); 
      display: flex; flex-direction: column; overflow: hidden;
    }

    .chat-header {
      display: flex; align-items: center; padding: 1.25rem 1.5rem; background: rgba(14, 165, 233, 0.05);
      border-bottom: 1px solid var(--border-color);
      .avatar {
        width: 48px; height: 48px; border-radius: 50%; background: #0ea5e9; color: white;
        display: flex; align-items: center; justify-content: center; margin-right: 1rem;
        mat-icon { font-size: 28px; width: 28px; height: 28px; }
      }
      .info {
        flex: 1;
        h2 { margin: 0; font-size: 1.1rem; color: var(--text-primary); }
        p { margin: 0; font-size: 0.8rem; color: #0ea5e9; font-weight: 600; }
      }
      .hybrid-progress-container {
        margin-left: auto; width: 200px;
        display: flex; align-items: center; justify-content: flex-end;
      }
      .water-bar {
        position: relative; width: 100%; height: 12px; background: rgba(14, 165, 233, 0.1); border-radius: 6px;
      }
      .water-fill {
        position: absolute; top: 0; left: 0; height: 100%; border-radius: 6px;
        transition: width 0.6s linear;
        background-color: #7dd3fc;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="12" viewBox="0 0 30 12"><path d="M0,6 Q7.5,2 15,6 T30,6 L30,12 L0,12 Z" fill="%230ea5e9"/></svg>');
        background-size: 30px 12px;
        animation: waterFlow 1.5s linear infinite;
      }
      .dolphin-wrapper {
        position: absolute; top: -13px; width: 30px; height: 30px;
        transition: left 0.6s linear;
        margin-left: -15px;
        z-index: 10;
      }
      .dolphin-wrapper.jumping {
        animation: jumpY 0.6s ease-in-out forwards;
      }
      .dolphin-bob {
        width: 100%; height: 100%;
        animation: floatBob 2s ease-in-out infinite;
      }
      .dolphin-emoji {
        font-size: 1.5rem;
        transform: scaleX(-1) rotate(-50deg);
        filter: saturate(0.2) brightness(0.8) drop-shadow(-2px 4px 4px rgba(71, 85, 105, 0.4));
      }
      .dolphin-wrapper.jumping .dolphin-emoji {
        animation: diveRotate 0.6s ease-in-out forwards;
      }
    }

    .chat-messages {
      flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;
      scroll-behavior: smooth;
    }

    .message-wrapper {
      display: flex; max-width: 80%;
      &.ai { align-self: flex-start; .message-bubble { background: #f1f5f9; color: #334155; border-bottom-left-radius: 4px; } }
      &.user { 
         align-self: flex-end; 
         .message-bubble { 
            background: #0ea5e9; color: white; border-bottom-right-radius: 4px; cursor: pointer; 
            transition: transform 0.2s;
            &:hover { transform: scale(1.02); background: #0284c7; }
         } 
      }
      
      .message-bubble {
        padding: 1rem 1.25rem; border-radius: 18px; font-size: 0.95rem; line-height: 1.5;
        box-shadow: 0 2px 5px rgba(0,0,0,0.02); animation: popIn 0.3s ease-out;
      }
    }

    .edit-options {
      display: flex; flex-direction: column; gap: 0.5rem;
      .edit-hint { font-size: 0.75rem; opacity: 0.8; font-weight: bold; text-transform: uppercase; }
      .mini-options {
        display: flex; flex-wrap: wrap; gap: 0.25rem;
        button {
          background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white;
          padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;
          &:hover { background: rgba(255,255,255,0.3); }
          &.active { background: white; color: #0ea5e9; font-weight: bold; border-color: white; }
        }
      }
      .cancel-edit {
        background: transparent; border: none; color: white; opacity: 0.8; font-size: 0.75rem; text-decoration: underline; cursor: pointer; text-align: right; margin-top: 4px;
        &:hover { opacity: 1; }
      }
    }

    .typing-dots {
      display: flex; gap: 4px; padding: 0.25rem 0.5rem;
      span { width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; animation: blink 1.4s infinite both; }
      span:nth-child(2) { animation-delay: 0.2s; }
      span:nth-child(3) { animation-delay: 0.4s; }
    }

    .chat-input-area {
      padding: 1.5rem; border-top: 1px solid var(--border-color); background: var(--bg-card);
      .quick-reply-label { margin: 0 0 0.75rem; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; text-align: center; }
      .quick-replies {
        display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center;
        .reply-btn {
          background: white; border: 1px solid #0ea5e9; color: #0ea5e9; padding: 0.75rem 1.25rem;
          border-radius: 20px; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.2s;
          &:hover { background: #0ea5e9; color: white; transform: translateY(-2px); box-shadow: 0 4px 6px rgba(14, 165, 233, 0.2); }
          &:active { transform: scale(0.95); }
        }
      }
    }

    @media (max-width: 767px) {
      .unlocked-content {
        padding: 4rem 1rem 1rem 1rem !important;
      }
      .unlocked-header {
        flex-direction: column;
        align-items: flex-start !important;
        gap: 0.75rem !important;
        h1 {
          font-size: 1.4rem !important;
        }
      }
      .recall-card {
        padding: 1rem !important;
        .card-header {
          flex-direction: column;
          align-items: flex-start !important;
          gap: 0.5rem !important;
        }
      }
      .placeholder-cards {
        grid-template-columns: 1fr !important;
      }
      .chat-container {
        padding-top: 3.5rem;
      }
      .chat-header {
        padding: 0.75rem 1rem !important;
        flex-direction: column;
        align-items: flex-start !important;
        gap: 0.75rem;
        
        .hybrid-progress-container {
          width: 100% !important;
          margin-left: 0 !important;
          justify-content: flex-start !important;
        }
      }
      .chat-messages {
        padding: 1rem !important;
      }
      .chat-input-area {
        padding: 1rem !important;
        .quick-replies {
          gap: 0.35rem !important;
          .reply-btn {
            padding: 0.5rem 0.85rem !important;
            font-size: 0.8rem !important;
          }
        }
      }
      .message-wrapper {
        max-width: 90% !important;
      }
    }

    @keyframes popIn {
      0% { opacity: 0; transform: translateY(10px) scale(0.95); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes blink {
      0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; }
    }
    @keyframes waterFlow {
      from { background-position: 30px 0; }
      to { background-position: 0 0; }
    }
    @keyframes jumpY {
      0%   { transform: translateY(0); }
      50%  { transform: translateY(-25px); }
      100% { transform: translateY(0); }
    }
    @keyframes floatBob {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-3px); }
    }
    @keyframes diveRotate {
      0%   { transform: scaleX(-1) rotate(-10deg); }
      40%  { transform: scaleX(-1) rotate(-50deg); }
      70%  { transform: scaleX(-1) rotate(-90deg); }
      100% { transform: scaleX(-1) rotate(-50deg); }
    }
  `]
})
export class AlimentaryDashboardComponent implements OnInit, AfterViewChecked {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  private clinicalService = inject(ClinicalService);

  loading = true;
  isUnlocked = false;
  
  quizFinished = false;
  isAiTyping = false;

  eatOptions = ['Siempre', 'Casi siempre', 'A menudo', 'A veces', 'Rara vez', 'Nunca'];
  behavioralOptions = ['Nunca', '1 vez al mes o menos', '2-3 veces al mes', '1 vez a la semana', '2-6 veces por semana', '1 vez al día o más'];
  yesNoOptions = ['Sí', 'No'];

  questions = [
    { id: 'q1', text: 'Me aterroriza la idea de tener sobrepeso.', options: this.eatOptions },
    { id: 'q2', text: 'Evito comer cuando tengo hambre.', options: this.eatOptions },
    { id: 'q3', text: 'Me doy cuenta de que estoy muy preocupado(a) por la comida.', options: this.eatOptions },
    { id: 'q4', text: 'He tenido atracones en los que siento que no puedo parar.', options: this.eatOptions },
    { id: 'q5', text: 'Corto mi comida en trozos muy pequeños.', options: this.eatOptions },
    { id: 'q6', text: 'Soy consciente del contenido calórico de lo que como.', options: this.eatOptions },
    { id: 'q7', text: 'Evito alimentos con alto contenido de carbohidratos.', options: this.eatOptions },
    { id: 'q8', text: 'Siento que los demás preferirían que comiera más.', options: this.eatOptions },
    { id: 'q9', text: 'Vomito después de haber comido.', options: this.eatOptions },
    { id: 'q10', text: 'Me siento extremadamente culpable después de comer.', options: this.eatOptions },
    { id: 'q11', text: 'Estoy preocupado(a) por el deseo de ser más delgado(a).', options: this.eatOptions },
    { id: 'q12', text: 'Pienso en quemar calorías cuando hago ejercicio.', options: this.eatOptions },
    { id: 'q13', text: 'Otras personas piensan que estoy demasiado delgado(a).', options: this.eatOptions },
    { id: 'q14', text: 'Me preocupa la idea de tener grasa en mi cuerpo.', options: this.eatOptions },
    { id: 'q15', text: 'Tardo más que los demás en comer mis comidas.', options: this.eatOptions },
    { id: 'q16', text: 'Evito los alimentos con azúcar.', options: this.eatOptions },
    { id: 'q17', text: 'Consumo alimentos dietéticos.', options: this.eatOptions },
    { id: 'q18', text: 'Siento que la comida controla mi vida.', options: this.eatOptions },
    { id: 'q19', text: 'Muestro autocontrol en torno a la comida.', options: this.eatOptions },
    { id: 'q20', text: 'Siento que los demás me presionan para comer.', options: this.eatOptions },
    { id: 'q21', text: 'Dedico demasiado tiempo y pensamientos a la comida.', options: this.eatOptions },
    { id: 'q22', text: 'Me siento incómodo(a) después de comer dulces.', options: this.eatOptions },
    { id: 'q23', text: 'Me involucro en conductas de dieta.', options: this.eatOptions },
    { id: 'q24', text: 'Me gusta que mi estómago esté vacío.', options: this.eatOptions },
    { id: 'q25', text: 'Tengo el impulso de vomitar después de las comidas.', options: this.eatOptions },
    { id: 'q26', text: 'Disfruto probar alimentos nuevos y ricos.', options: this.eatOptions },
    { id: 'bA', text: 'En los últimos 6 meses, ¿Te has dado atracones en los que sientes que no puedes parar?', options: this.behavioralOptions },
    { id: 'bB', text: 'En los últimos 6 meses, ¿Te has provocado el vómito para controlar tu peso o forma?', options: this.behavioralOptions },
    { id: 'bC', text: 'En los últimos 6 meses, ¿Has usado laxantes, pastillas para adelgazar o diuréticos?', options: this.behavioralOptions },
    { id: 'bD', text: 'En los últimos 6 meses, ¿Has hecho ejercicio más de 60 minutos al día para perder peso?', options: this.behavioralOptions },
    { id: 'bE', text: '¿Has perdido 10 kg (20 libras) o más en los últimos 6 meses?', options: this.yesNoOptions }
  ];

  totalQuestions = this.questions.length;
  currentQuestionIndex = 0;
  completedQuestions = 0;
  isJumping = false;
  answers: any = {};
  
  messages: ChatMessage[] = [];

  // Recordatorio de 24 Horas
  clinicalNotesObj: any = {};
  recallEntries: any[] = [];
  availableDates: { dateStr: string, label: string }[] = [];
  selectedDateStr: string = '';
  isSavingRecall = false;

  currentRecall = {
    desayuno: '',
    colacion1: '',
    comida: '',
    colacion2: '',
    cena: '',
    calorias_totales: 0
  };

  get currentQuestion() {
    return this.questions[this.currentQuestionIndex];
  }

  getProgressRatio() {
    return this.totalQuestions > 0 ? this.completedQuestions / this.totalQuestions : 0;
  }

  async ngOnInit() {
    this.generateLast7Days();
    await this.checkStatus();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      if (this.myScrollContainer) {
        this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }

  generateLast7Days() {
    const dates = [];
    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      
      const year = d.getFullYear();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      let label = '';
      if (i === 0) label = 'Hoy';
      else if (i === 1) label = 'Ayer';
      else label = `${daysOfWeek[d.getDay()]} ${d.getDate()}`;
      
      dates.push({ dateStr, label });
    }
    this.availableDates = dates;
  }

  async checkStatus() {
    this.loading = true;
    const record = await this.clinicalService.getClinicalRecord();
    
    if (record && record.decrypted_notes) {
      try {
        this.clinicalNotesObj = JSON.parse(record.decrypted_notes);
        // Si tiene la pregunta 1 del EAT-26, consideramos desbloqueado
        if (this.clinicalNotesObj.q1) {
          this.isUnlocked = true;
          this.loadRecallEntries();
        }
      } catch (e) {}
    }
    
    if (!this.isUnlocked) {
      this.startChat();
    }
    
    this.loading = false;
  }

  loadRecallEntries() {
    this.recallEntries = this.clinicalNotesObj.recall_24h || [];
    this.selectRecallDate(this.availableDates[0].dateStr); // Seleccionar hoy por defecto
  }

  selectRecallDate(dateStr: string) {
    this.selectedDateStr = dateStr;
    const existing = this.recallEntries.find(r => r.date === dateStr);
    if (existing) {
      this.currentRecall = {
        desayuno: existing.desayuno || '',
        colacion1: existing.colacion1 || '',
        comida: existing.comida || '',
        colacion2: existing.colacion2 || '',
        cena: existing.cena || '',
        calorias_totales: existing.calorias_totales || 0
      };
    } else {
      this.currentRecall = {
        desayuno: '',
        colacion1: '',
        comida: '',
        colacion2: '',
        cena: '',
        calorias_totales: 0
      };
    }
  }

  async saveRecall() {
    this.isSavingRecall = true;
    
    // Buscar si ya existe la entrada para esta fecha
    const index = this.recallEntries.findIndex(r => r.date === this.selectedDateStr);
    const newEntry = {
      date: this.selectedDateStr,
      ...this.currentRecall
    };
    
    if (index > -1) {
      this.recallEntries[index] = newEntry;
    } else {
      this.recallEntries.push(newEntry);
    }
    
    // Guardar en el objeto principal
    this.clinicalNotesObj.recall_24h = this.recallEntries;
    
    // Cifrar y guardar en Supabase
    const success = await this.clinicalService.updateClinicalRecords([JSON.stringify(this.clinicalNotesObj)]);
    this.isSavingRecall = false;
    
    if (success) {
      alert('Recordatorio de 24 horas guardado correctamente.');
    } else {
      alert('Error al guardar el recordatorio.');
    }
  }

  startChat() {
    this.messages.push({
      id: 'welcome',
      sender: 'ai',
      text: '¡Hola! 👋 Para poder abrir y personalizar tu módulo alimentario, necesito hacerte algunas preguntas rápidas.'
    });
    
    setTimeout(() => {
      this.messages.push({
        id: 'q_' + this.currentQuestionIndex,
        sender: 'ai',
        text: this.currentQuestion.text
      });
    }, 800);
  }

  selectOption(opt: string) {
    this.completedQuestions++;
    this.isJumping = true;
    setTimeout(() => this.isJumping = false, 600);

    // 1. Mostrar respuesta del usuario
    this.messages.push({
      id: 'a_' + this.currentQuestionIndex,
      sender: 'user',
      text: opt,
      options: this.currentQuestion.options,
      questionId: this.currentQuestion.id
    });

    this.answers[this.currentQuestion.id] = opt;
    this.isAiTyping = true;

    // 2. Simular que Amati está escribiendo
    const typingId = 'typing_' + Date.now();
    this.messages.push({ id: typingId, sender: 'ai', text: '', isTyping: true });

    setTimeout(() => {
      // Remover indicador de escritura
      this.messages = this.messages.filter(m => m.id !== typingId);
      this.isAiTyping = false;

      if (this.currentQuestionIndex < this.totalQuestions - 1) {
        this.currentQuestionIndex++;
        
        // Frases motivacionales cada 6 preguntas
        if (this.currentQuestionIndex % 6 === 0) {
           const phraseIndex = (this.currentQuestionIndex / 6) - 1;
           const motivationalPhrases = [
             "¡Vas muy bien! Gracias por tu sinceridad. 🌟",
             "Estás haciendo un gran trabajo. Seguimos avanzando. 💪",
             "¡Ya falta menos! Conocer tus hábitos nos ayuda a personalizar mejor tu espacio. ✨",
             "¡Excelente ritmo! Cada respuesta es valiosa. 🚀",
             "Ya casi terminamos, ¡agradezco tu paciencia! 😊"
           ];
           
           if (motivationalPhrases[phraseIndex]) {
               this.messages.push({
                   id: 'motiv_' + this.currentQuestionIndex,
                   sender: 'ai',
                   text: motivationalPhrases[phraseIndex]
               });
           }
        }

        this.messages.push({
          id: 'q_' + this.currentQuestionIndex,
          sender: 'ai',
          text: this.currentQuestion.text
        });
      } else {
        this.finishQuiz();
      }
    }, 600); // 600ms de retraso realista
  }

  editAnswer(msg: ChatMessage) {
    if (msg.sender !== 'user' || this.isAiTyping || this.quizFinished) return;
    msg.isEditing = true;
  }

  saveEdit(msg: ChatMessage, newOpt: string) {
    if (msg.questionId) {
      this.answers[msg.questionId] = newOpt;
    }
    msg.text = newOpt;
    msg.isEditing = false;
  }

  async finishQuiz() {
    this.quizFinished = true;
    
    this.messages.push({
      id: 'finish',
      sender: 'ai',
      text: '¡Excelente! He registrado todas tus respuestas en tu expediente clínico de forma segura. Desbloqueando módulo... 🚀'
    });
    
    const record = await this.clinicalService.getClinicalRecord();
    let existing = {};
    if (record && record.decrypted_notes) {
      try { existing = JSON.parse(record.decrypted_notes); } catch(e) {}
    }

    this.clinicalNotesObj = { ...existing, ...this.answers };
    await this.clinicalService.updateClinicalRecords([JSON.stringify(this.clinicalNotesObj)]);
    
    setTimeout(() => {
      this.isUnlocked = true;
      this.loadRecallEntries();
    }, 2000);
  }
}
