import { Component, OnInit, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { AgendaService } from '../../../../core/services/agenda.service';
import { AuthService } from '../../../../core/services/auth.service';

export interface EmergencyModalData {
  appointment: any;
}

@Component({
  selector: 'app-emergency-change-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div class="emergency-modal-container">
      <!-- Glassmorphic Header -->
      <div class="modal-header">
        <div class="header-title">
          <div class="emergency-icon-wrapper">
            <mat-icon class="pulse-icon">warning</mat-icon>
          </div>
          <div class="title-text">
            <h2>Gestión de Cambio por Emergencia</h2>
            <span class="subtitle">Modificación urgente y difusión simultánea al paciente</span>
          </div>
        </div>
        <button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="modal-body">
        <!-- Patient & Appointment Context -->
        <div class="patient-card glass-card">
          <div class="avatar">
            <img *ngIf="data.appointment?.student?.profiles?.avatar_url" [src]="data.appointment.student.profiles.avatar_url" alt="Avatar">
            <mat-icon *ngIf="!data.appointment?.student?.profiles?.avatar_url">person</mat-icon>
          </div>
          <div class="details">
            <span class="label">Paciente Afectado</span>
            <span class="name">{{ data.appointment?.student?.profiles?.first_name || 'Paciente' }} {{ data.appointment?.student?.profiles?.last_name || '' }}</span>
            <span class="datetime">
              📅 {{ data.appointment?.scheduled_date | date:'longDate' }} | ⏰ {{ data.appointment?.start_time ? data.appointment.start_time.substring(0,5) : '00:00' }}
            </span>
          </div>
        </div>

        <!-- 3 Dynamic Tabs / Options -->
        <div class="tabs-container">
          <button class="tab-btn cancel-tab" [class.active]="actionType === 'cancel'" (click)="setActionType('cancel')">
            <span class="tab-icon">❌</span>
            <span class="tab-label">Cancelar Cita</span>
          </button>
          <button class="tab-btn virtual-tab" [class.active]="actionType === 'virtual'" (click)="setActionType('virtual')">
            <span class="tab-icon">🌐</span>
            <span class="tab-label">Pasar a Virtual</span>
          </button>
          <button class="tab-btn relocate-tab" [class.active]="actionType === 'relocate'" (click)="setActionType('relocate')">
            <span class="tab-icon">📍</span>
            <span class="tab-label">Mover de Lugar</span>
          </button>
        </div>

        <!-- Dynamic Form Controls -->
        <div class="form-section glass-card" [ngSwitch]="actionType">
          
          <!-- Option 1: Cancelar Cita -->
          <div *ngSwitchCase="'cancel'" class="form-group">
            <div class="alert-box danger-alert">
              <mat-icon>error_outline</mat-icon>
              <span>La cita será cancelada inmediatamente debido a una emergencia inesperada.</span>
            </div>
            <label class="form-label">Motivo de la Emergencia / Cancelación:</label>
            <textarea [(ngModel)]="reason" rows="3" placeholder="Ej. Urgencia médica, imposibilidad de traslado, contingencia en facultad..." class="glass-input"></textarea>
          </div>

          <!-- Option 2: Pasar a Virtual -->
          <div *ngSwitchCase="'virtual'" class="form-group">
            <div class="alert-box info-alert">
              <mat-icon>videocam</mat-icon>
              <span>Se migra la sesión a modalidad virtual instantáneamente.</span>
            </div>
            <label class="form-label">Enlace de la Sesión Virtual (Teams/Zoom/Meet):</label>
            <input type="text" [(ngModel)]="details" placeholder="https://teams.microsoft.com/l/meetup-join/..." class="glass-input" />
            <span class="field-hint" *ngIf="defaultVirtualLink">🔗 Obtenido de la configuración de tu consultorio virtual</span>
          </div>

          <!-- Option 3: Mover de Lugar -->
          <div *ngSwitchCase="'relocate'" class="form-group">
            <div class="alert-box warning-alert">
              <mat-icon>place</mat-icon>
              <span>Reubicación física de emergencia (cambio de edificio o consultorio).</span>
            </div>
            <label class="form-label">Nueva Ubicación / Edificio / Consultorio / Facultad:</label>
            <input type="text" [(ngModel)]="details" placeholder="Ej. Edificio de Posgrado, Sala de Juntas 2, Cubículo B..." class="glass-input" />
            <span class="field-hint" *ngIf="defaultPhysicalLocation">📍 Ubicación habitual: {{ defaultPhysicalLocation }}</span>
          </div>
        </div>

        <!-- Dual Simultaneous Broadcast Checkboxes -->
        <div class="broadcast-section glass-card">
          <div class="broadcast-header">
            <mat-icon class="broadcast-icon">podcasts</mat-icon>
            <h3>Dual Simultaneous Broadcast (Difusión Urgente)</h3>
          </div>
          <p class="broadcast-description">Selecciona los canales oficiales de alta prioridad para notificar al paciente en tiempo real.</p>
          
          <div class="alert-box compliance-alert">
            <mat-icon>health_and_safety</mat-icon>
            <span><strong>Privacidad NOM-024 y HIPAA:</strong> Por seguridad, no incluyas diagnósticos clínicos ni información médica sensible (PHI) en los campos de texto anteriores. Los avisos por WhatsApp son de carácter estrictamente operativo.</span>
          </div>
          
          <div class="checkbox-list">
            <label class="glass-checkbox">
              <input type="checkbox" [(ngModel)]="notifyWebPush" />
              <span class="checkmark"></span>
              <span class="checkbox-text">
                <strong>🔔 Prioridad 1: Notificación Push en Navegador (Web Push PWA)</strong>
                <span class="subtext">Aviso instantáneo en pantalla de escritorio o móvil si tiene instalada la PWA.</span>
              </span>
            </label>

            <label class="glass-checkbox">
              <input type="checkbox" [(ngModel)]="notifyWhatsApp" />
              <span class="checkmark"></span>
              <span class="checkbox-text">
                <strong>🟢 Prioridad 2: Aviso Urgente por WhatsApp API Oficial (Bidireccional)</strong>
                <span class="subtext">Mensaje oficial automatizado con botones de confirmación de enterado.</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- Glassmorphic Footer -->
      <div class="modal-footer">
        <button mat-button (click)="close()" class="cancel-btn">Descartar</button>
        <button mat-flat-button class="confirm-btn" [ngClass]="actionType" (click)="confirm()">
          <mat-icon>send</mat-icon>
          <span>Transmitir Aviso de Emergencia</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    *, *:before, *:after {
      box-sizing: border-box;
    }

    .emergency-modal-container {
      display: flex;
      flex-direction: column;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      max-height: 92vh;
      width: 100%;
      overflow: hidden;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(248, 250, 252, 0.95) 100%);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.6);
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2);
    }

    .modal-header {
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding: 18px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(226, 232, 240, 0.8);
      flex-shrink: 0;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .emergency-icon-wrapper {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      box-shadow: 0 8px 16px rgba(239, 68, 68, 0.3);
    }

    .pulse-icon {
      animation: emergencyPulse 2s infinite;
    }

    @keyframes emergencyPulse {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.18); opacity: 0.8; }
      100% { transform: scale(1); opacity: 1; }
    }

    .title-text h2 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.02em;
    }

    .title-text .subtitle {
      font-size: 0.82rem;
      color: #64748b;
      font-weight: 500;
    }

    .close-btn {
      background: rgba(241, 245, 249, 0.8);
      border: 1px solid rgba(226, 232, 240, 0.8);
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #64748b;
      transition: all 0.2s ease;

      &:hover {
        background: #ef4444;
        color: white;
        transform: rotate(90deg);
      }
    }

    .modal-body {
      padding: 20px 24px;
      overflow-y: auto;
      overflow-x: hidden;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .glass-card {
      background: rgba(255, 255, 255, 0.65);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.8);
      border-radius: 16px;
      padding: 16px 20px;
      box-shadow: 0 4px 20px rgba(100, 116, 139, 0.08);
    }

    .patient-card {
      display: flex;
      align-items: center;
      gap: 16px;
      border-left: 4px solid #8b5cf6;
    }

    .patient-card .avatar {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #e2e8f0;
      border: 2px solid #8b5cf6;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      color: #8b5cf6;
      flex-shrink: 0;
      
      img { width: 100%; height: 100%; object-fit: cover; }
      mat-icon { font-size: 28px; width: 28px; height: 28px; }
    }

    .patient-card .details {
      display: flex;
      flex-direction: column;
    }

    .patient-card .label { font-size: 0.72rem; color: #8b5cf6; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .patient-card .name { font-size: 1.15rem; font-weight: 700; color: #1e293b; margin-top: 2px; }
    .patient-card .datetime { font-size: 0.85rem; color: #475569; font-weight: 500; margin-top: 4px; }

    .tabs-container {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      background: rgba(241, 245, 249, 0.6);
      padding: 6px;
      border-radius: 16px;
      border: 1px solid rgba(226, 232, 240, 0.8);
    }

    .tab-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 14px;
      border: none;
      border-radius: 12px;
      background: transparent;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.92rem;
      font-weight: 600;
      color: #64748b;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        color: #0f172a;
        background: rgba(255, 255, 255, 0.5);
      }

      &.active {
        background: white;
        color: #0f172a;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.9);
      }
    }

    .tab-btn.cancel-tab.active { border-bottom: 3px solid #ef4444; }
    .tab-btn.virtual-tab.active { border-bottom: 3px solid #3b82f6; }
    .tab-btn.relocate-tab.active { border-bottom: 3px solid #f59e0b; }

    .tab-icon { font-size: 1.1rem; }

    .form-section {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .alert-box {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 0.88rem;
      font-weight: 500;
      margin-bottom: 14px;

      mat-icon { font-size: 22px; width: 22px; height: 22px; flex-shrink: 0; }
    }

    .danger-alert { background: rgba(254, 242, 242, 0.8); border: 1px solid #fca5a5; color: #991b1b; mat-icon { color: #ef4444; } }
    .info-alert { background: rgba(239, 246, 255, 0.8); border: 1px solid #93c5fd; color: #1e40af; mat-icon { color: #3b82f6; } }
    .warning-alert { background: rgba(255, 251, 235, 0.8); border: 1px solid #fcd34d; color: #b45309; mat-icon { color: #f59e0b; } }
    .compliance-alert { background: rgba(240, 253, 244, 0.8); border: 1px solid #86efac; color: #15803d; mat-icon { color: #16a34a; } }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .form-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
    }

    .glass-input {
      width: 100%;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      font-family: inherit;
      font-size: 0.95rem;
      color: #1e293b;
      outline: none;
      transition: all 0.2s ease;
      box-shadow: inset 0 2px 4px rgba(15, 23, 42, 0.02);

      &:focus {
        border-color: #8b5cf6;
        box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
        background: white;
      }
    }

    textarea.glass-input {
      resize: vertical;
      min-height: 80px;
    }

    .field-hint {
      font-size: 0.78rem;
      color: #64748b;
      margin-top: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .broadcast-section {
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: rgba(248, 250, 252, 0.7);
      border: 1px solid rgba(226, 232, 240, 0.9);
    }

    .broadcast-header {
      display: flex;
      align-items: center;
      gap: 10px;

      .broadcast-icon { color: #8b5cf6; font-size: 24px; width: 24px; height: 24px; }
      h3 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #1e293b; }
    }

    .broadcast-description {
      margin: 0;
      font-size: 0.85rem;
      color: #64748b;
      line-height: 1.4;
    }

    .checkbox-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 4px;
    }

    .glass-checkbox {
      display: flex;
      align-items: flex-start;
      position: relative;
      padding-left: 38px;
      cursor: pointer;
      user-select: none;

      input {
        position: absolute;
        opacity: 0;
        cursor: pointer;
        height: 0;
        width: 0;
      }

      .checkmark {
        position: absolute;
        top: 2px;
        left: 0;
        height: 24px;
        width: 24px;
        background-color: rgba(255, 255, 255, 0.8);
        border: 2px solid #cbd5e1;
        border-radius: 8px;
        transition: all 0.2s ease;

        &:after {
          content: "";
          position: absolute;
          display: none;
          left: 7px;
          top: 3px;
          width: 6px;
          height: 12px;
          border: solid white;
          border-width: 0 3px 3px 0;
          transform: rotate(45deg);
        }
      }

      &:hover input ~ .checkmark {
        border-color: #8b5cf6;
      }

      input:checked ~ .checkmark {
        background-color: #8b5cf6;
        border-color: #8b5cf6;
        box-shadow: 0 4px 10px rgba(139, 92, 246, 0.3);
      }

      input:checked ~ .checkmark:after {
        display: block;
      }

      .checkbox-text {
        display: flex;
        flex-direction: column;
        gap: 2px;

        strong { font-size: 0.92rem; color: #1e293b; font-weight: 600; }
        .subtext { font-size: 0.8rem; color: #64748b; line-height: 1.3; }
      }
    }

    .modal-footer {
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding: 16px 24px;
      border-top: 1px solid rgba(226, 232, 240, 0.8);
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .cancel-btn {
      color: #64748b;
      font-weight: 600;
      padding: 0 16px;
      border-radius: 12px;
      &:hover { background: rgba(226, 232, 240, 0.6); color: #0f172a; }
    }

    .confirm-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 22px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 0.95rem;
      color: white;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.15);
      transition: all 0.2s ease;

      mat-icon { font-size: 20px; width: 20px; height: 20px; }

      &.cancel { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); box-shadow: 0 8px 20px rgba(239, 68, 68, 0.3); }
      &.virtual { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3); }
      &.relocate { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3); }

      &:hover { transform: translateY(-2px); filter: brightness(1.05); }
      &:active { transform: translateY(0); }
    }
  `]
})
export class EmergencyChangeModalComponent implements OnInit {
  authService = inject(AuthService);
  agendaService = inject(AgendaService);

  actionType: 'cancel' | 'virtual' | 'relocate' = 'cancel';
  reason: string = '';
  details: string = '';
  
  notifyWebPush: boolean = true;
  notifyWhatsApp: boolean = true;

  defaultVirtualLink: string = '';
  defaultPhysicalLocation: string = '';

  constructor(
    public dialogRef: MatDialogRef<EmergencyChangeModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EmergencyModalData
  ) {}

  async ngOnInit() {
    const currentUserId = this.authService.currentUser()?.id;
    if (currentUserId) {
      const settings = await this.agendaService.getSettings(currentUserId);
      if (settings) {
        if (settings.location && settings.modality === 'virtual') {
          this.defaultVirtualLink = settings.location;
        } else if (settings.location) {
          this.defaultPhysicalLocation = settings.location;
        }
        if (settings.building || settings.office_room) {
          const b = settings.building || '';
          const o = settings.office_room || '';
          this.defaultPhysicalLocation += ` (${b} - ${o})`.trim();
        }
      }
    }
  }

  setActionType(type: 'cancel' | 'virtual' | 'relocate') {
    this.actionType = type;
    if (type === 'virtual' && !this.details && this.defaultVirtualLink) {
      this.details = this.defaultVirtualLink;
    } else if (type === 'relocate' && !this.details && this.defaultPhysicalLocation) {
      this.details = this.defaultPhysicalLocation;
    }
  }

  close() {
    this.dialogRef.close();
  }

  sanitizeInput(input: string): string {
    if (!input) return '';
    // Elimina etiquetas HTML/XML y caracteres potencialmente peligrosos para prevenir XSS
    return input
      .replace(/<[^>]*>?/gm, '')
      .replace(/[<>]/g, '')
      .trim();
  }

  confirm() {
    const sanitizedReason = this.sanitizeInput(this.reason);
    const sanitizedDetails = this.sanitizeInput(this.details);

    if (this.actionType === 'cancel' && !sanitizedReason) {
      alert('Por favor, especifica el motivo de la cancelación de emergencia.');
      return;
    }
    if ((this.actionType === 'virtual' || this.actionType === 'relocate') && !sanitizedDetails) {
      alert('Por favor, ingresa los detalles del cambio (enlace o nueva ubicación).');
      return;
    }

    this.dialogRef.close({
      actionType: this.actionType,
      reason: sanitizedReason || 'Cambio de emergencia',
      details: sanitizedDetails,
      notifyWebPush: this.notifyWebPush,
      notifyWhatsApp: this.notifyWhatsApp
    });
  }
}
