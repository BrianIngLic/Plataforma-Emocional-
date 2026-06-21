import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="dashboard-container" [ngClass]="{'chat-mode': !loading && !isUnlocked}">
      <div *ngIf="loading" class="loading-state">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Verificando expediente...</p>
      </div>

      <!-- ESTADO 1: DESBLOQUEADO (MÓDULO PRINCIPAL) -->
      <ng-container *ngIf="!loading && isUnlocked">
        <div class="unlocked-content" style="padding: 1.5rem;">
          <div class="unlocked-header">
            <div class="header-icon">
              <mat-icon>restaurant</mat-icon>
            </div>
            <div class="header-text">
              <h1>Módulo Alimentario</h1>
              <p>Bienvenido a tu espacio de nutrición y bienestar.</p>
            </div>
          </div>

          <div class="placeholder-cards">
            <div class="glass-card">
              <mat-icon>favorite</mat-icon>
              <h3>Salud Nutricional</h3>
              <p>Próximamente encontrarás aquí guías y seguimiento.</p>
            </div>
            <div class="glass-card">
              <mat-icon>insights</mat-icon>
              <h3>Tus Resultados</h3>
              <p>Tu cuestionario inicial ha sido anexado a tu expediente clínico de manera segura.</p>
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
              <h2>EmolA Clínico</h2>
              <p>Desbloqueo de Módulo Alimentario</p>
            </div>
            <div class="progress-indicator">
              <span>{{ currentQuestionIndex }} / {{ totalQuestions }}</span>
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
      height: 100%;
    }

    .dashboard-container {
      min-height: 100%;
      height: 100%;
      
      &.chat-mode {
        padding: 0;
        display: flex;
        flex-direction: column;
      }
    }
    
    .loading-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50vh; color: var(--text-secondary);
      mat-spinner { margin-bottom: 1rem; }
    }

    /* Módulo Desbloqueado */
    .unlocked-header {
      display: flex; align-items: center; gap: 1.5rem; margin-bottom: 3rem;
      .header-icon {
        width: 64px; height: 64px; border-radius: 16px; background: rgba(16, 185, 129, 0.1); color: #10b981;
        display: flex; align-items: center; justify-content: center;
        mat-icon { font-size: 32px; width: 32px; height: 32px; }
      }
      .header-text {
        h1 { margin: 0; font-size: 2rem; color: var(--text-primary); }
        p { margin: 0.5rem 0 0; color: var(--text-secondary); font-size: 1.1rem; }
      }
    }

    .placeholder-cards {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;
      .glass-card {
        background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 2rem; text-align: center;
        mat-icon { font-size: 40px; width: 40px; height: 40px; color: #0ea5e9; margin-bottom: 1rem; }
        h3 { margin: 0 0 1rem; color: var(--text-primary); }
        p { margin: 0; color: var(--text-secondary); line-height: 1.6; }
      }
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
      .progress-indicator {
        background: white; border: 1px solid var(--border-color); padding: 4px 12px; border-radius: 20px;
        font-family: monospace; font-weight: bold; color: var(--text-secondary); font-size: 0.85rem;
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

    @keyframes popIn {
      0% { opacity: 0; transform: translateY(10px) scale(0.95); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes blink {
      0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; }
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
  answers: any = {};
  
  messages: ChatMessage[] = [];

  get currentQuestion() {
    return this.questions[this.currentQuestionIndex];
  }

  async ngOnInit() {
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

  async checkStatus() {
    this.loading = true;
    const record = await this.clinicalService.getClinicalRecord();
    
    if (record && record.decrypted_notes) {
      try {
        const parsed = JSON.parse(record.decrypted_notes);
        if (parsed.q1) {
          this.isUnlocked = true;
        }
      } catch (e) {}
    }
    
    if (!this.isUnlocked) {
      this.startChat();
    }
    
    this.loading = false;
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

    // 2. Simular que EmolA está escribiendo
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

    const mergedData = { ...existing, ...this.answers };
    await this.clinicalService.updateClinicalRecords([JSON.stringify(mergedData)]);
    
    setTimeout(() => {
      this.isUnlocked = true;
    }, 2000);
  }
}
