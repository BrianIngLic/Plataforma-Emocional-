import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule
} from '@angular/material/dialog';

export interface AppointmentModalData {
  psychologistName: string;
  psychologistEmail?: string;
  psychologistAvatar?: string;
  location: string;
  modality?: string;
  building?: string;
  officeRoom?: string;
  facultyName?: string;
  virtualTourUrl?: string;
  dateStr: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'my_reservation';
  id?: string; // appointment id if modifying/canceling
  professionalRoleTitle?: string;
}

@Component({
  selector: 'app-appointment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div class="modal-container">
      <div class="modal-header" [class.is-mine]="data.status === 'my_reservation'">
        <h2>
          <mat-icon *ngIf="data.status === 'available'">event_available</mat-icon>
          <mat-icon *ngIf="data.status === 'my_reservation'">event_note</mat-icon>
          {{ data.status === 'available' ? 'Confirmar Reserva' : 'Tu Cita Programada' }}
        </h2>
        <button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="modal-body">
        <div class="info-card">
          <div class="psychologist-profile-card">
            <div class="avatar">
              <img *ngIf="data.psychologistAvatar" [src]="data.psychologistAvatar" alt="Avatar">
              <mat-icon *ngIf="!data.psychologistAvatar">person</mat-icon>
            </div>
            <div class="details">
              <span class="role">{{ data.professionalRoleTitle || 'Especialista Asignado' }}</span>
              <span class="name">{{ data.psychologistName || 'Especialista Asignado' }}</span>
              <span class="email">{{ data.psychologistEmail || 'contacto@buap.mx' }}</span>
            </div>
          </div>
          
          <div class="info-row">
            <mat-icon>{{ data.modality === 'presencial' ? 'business' : 'videocam' }}</mat-icon>
            <div class="text-block" style="flex: 1;">
              <span class="label">Modalidad y Lugar de Atención</span>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                <span class="modality-tag" [class.presential]="data.modality === 'presencial'">
                  {{ data.modality === 'presencial' ? '🏢 Presencial' : '🌐 Virtual' }}
                </span>
                <span class="value" *ngIf="data.modality !== 'presencial'">{{ data.location || 'Consultorio Virtual' }}</span>
              </div>
              
              <div *ngIf="data.modality === 'presencial'" style="margin-top: 6px; background: #f8fafc; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <div style="font-size: 0.88rem; color: #1e293b;">
                  <strong>Edificio:</strong> {{ data.building || 'Edificio Principal' }} | <strong>Consultorio:</strong> {{ data.officeRoom || 'Privado' }}
                </div>
                <div *ngIf="data.facultyName" style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">
                  📌 {{ data.facultyName }}
                </div>
                <a *ngIf="data.virtualTourUrl" [href]="data.virtualTourUrl" target="_blank" style="display: flex; align-items: center; gap: 6px; background: #8b5cf6; color: white; padding: 4px 12px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 0.8rem; margin-top: 6px; width: fit-content; box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);">
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px;">360</mat-icon> 📍 Explorar Recorrido Virtual
                </a>
              </div>
            </div>
          </div>

          <div class="info-row">
            <mat-icon>calendar_today</mat-icon>
            <div class="text-block">
              <span class="label">Fecha</span>
              <span class="value" style="text-transform: capitalize;">{{ formattedSpanishDate }}</span>
            </div>
          </div>

          <div class="info-row">
            <mat-icon>schedule</mat-icon>
            <div class="text-block">
              <span class="label">Horario</span>
              <span class="value">{{ cleanStartTime }} - {{ cleanEndTime }}</span>
            </div>
          </div>
        </div>

        <div class="warning-text" *ngIf="data.status === 'available'">
          Al confirmar, esta hora quedará bloqueada para ti. Recuerda asistir puntualmente.
        </div>
        
        <div *ngIf="data.status === 'my_reservation'" class="cancellation-section" style="margin-top: 12px;">
          <div class="warning-text cancel-warning" style="margin-top: 0; margin-bottom: 8px; padding: 8px 10px;">
            Si cancelas, perderás este espacio y otro estudiante podrá tomarlo.
          </div>
          <div class="input-group" style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 0.8rem; font-weight: 600; color: #334155;">Motivo de la Cancelación (Opcional):</label>
            <textarea [(ngModel)]="cancellationReason" rows="2" placeholder="Ej. Motivos de salud, examen inesperado, etc." style="width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 0.85rem; outline: none; resize: none; box-sizing: border-box;"></textarea>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button mat-button (click)="close()" class="cancel-btn">Regresar</button>
        <button mat-flat-button 
                [class.btn-primary]="data.status === 'available'"
                [class.btn-danger]="data.status === 'my_reservation'"
                (click)="action()">
          <mat-icon *ngIf="data.status === 'available'">check_circle</mat-icon>
          <mat-icon *ngIf="data.status === 'my_reservation'">cancel</mat-icon>
          {{ data.status === 'available' ? 'Confirmar Cita' : 'Cancelar Cita' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    *, *:before, *:after {
      box-sizing: border-box;
    }
    .modal-container {
      display: flex;
      flex-direction: column;
      font-family: 'Inter', sans-serif;
      max-height: 90vh;
      width: 100%;
      overflow: hidden;
      box-sizing: border-box;
    }
    .modal-header {
      background: #f8fafc;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
      width: 100%;

      &.is-mine {
        background: #8b5cf6;
        border-bottom-color: #7c3aed;
        h2 { color: white; }
        .close-btn { color: white; opacity: 0.8; &:hover { opacity: 1; color: white; } }
      }

      h2 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #1e293b;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
      .close-btn {
        background: transparent; border: none; cursor: pointer; color: #64748b;
        display: flex; align-items: center; justify-content: center; padding: 0;
        &:hover { color: #0f172a; }
      }
    }
    .modal-body {
      padding: 14px 20px;
      overflow-y: auto;
      overflow-x: hidden;
      flex: 1;
      width: 100%;
      box-sizing: border-box;
    }
    .modality-tag {
      background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
      &.presential { background: #6d28d9; }
    }
    .info-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;
    }
    .psychologist-profile-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 10px;
      border-bottom: 1px dashed #e2e8f0;
      margin-bottom: 2px;

      .avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #f1f5f9;
        border: 2px solid #8b5cf6;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
        color: #8b5cf6;
        
        img { width: 100%; height: 100%; object-fit: cover; }
        mat-icon { font-size: 24px; width: 24px; height: 24px; opacity: 0.8; }
      }

      .details {
        display: flex;
        flex-direction: column;
        
        .role { font-size: 0.7rem; color: #8b5cf6; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .name { font-size: 1rem; color: #0f172a; font-weight: 600; margin-top: 2px; }
        .email { font-size: 0.8rem; color: #64748b; margin-top: 2px; }
      }
    }
    .info-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      mat-icon { color: #8b5cf6; font-size: 18px; width: 18px; height: 18px; margin-top: 1px; }
      .text-block {
        display: flex;
        flex-direction: column;
        .label { font-size: 0.7rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .value { font-size: 0.9rem; color: #0f172a; font-weight: 500; margin-top: 2px; }
      }
    }
    .warning-text {
      margin-top: 12px;
      font-size: 0.82rem;
      color: #64748b;
      text-align: center;
      background: #f8fafc;
      padding: 8px 10px;
      border-radius: 8px;
    }
    .cancel-warning {
      background: #fef2f2;
      color: #991b1b;
    }
    .modal-footer {
      padding: 10px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      flex-shrink: 0;
      width: 100%;
    }
    .btn-primary { background: #8b5cf6; color: white; }
    .btn-danger { background: #ef4444; color: white; }
    button[mat-flat-button] {
      display: flex; align-items: center; gap: 6px; font-weight: 600;
    }
  `]
})
export class AppointmentModalComponent {
  cancellationReason: string = '';

  constructor(
    public dialogRef: MatDialogRef<AppointmentModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AppointmentModalData
  ) {}

  get formattedSpanishDate(): string {
    if (!this.data.dateStr) return '';
    try {
      // Extraer solo la porción YYYY-MM-DD para evitar fallos con ISO strings (ej. 2026-07-05T00:00:00.000Z)
      const cleanDate = this.data.dateStr.substring(0, 10);
      const parts = cleanDate.split('-');
      if (parts.length !== 3) return this.data.dateStr;
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (isNaN(date.getTime())) return this.data.dateStr;
      const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      return `${dias[date.getDay()]}, ${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
    } catch (e) {
      return this.data.dateStr;
    }
  }

  get cleanStartTime(): string {
    return this.data.startTime ? this.data.startTime.substring(0, 5) : '';
  }

  get cleanEndTime(): string {
    if (!this.data.endTime) return '';
    if (this.data.endTime === this.data.startTime) {
      const parts = this.data.startTime.substring(0,5).split(':');
      if (parts.length === 2) {
        const h = Number(parts[0]);
        const m = Number(parts[1]);
        const endM = (m + 50) % 60;
        const endH = h + Math.floor((m + 50) / 60);
        return `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;
      }
    }
    return this.data.endTime.substring(0, 5);
  }

  close(): void {
    this.dialogRef.close();
  }

  action(): void {
    this.dialogRef.close({ 
      action: this.data.status === 'available' ? 'book' : 'cancel', 
      id: this.data.id,
      reason: this.cancellationReason.trim() || 'Sin motivo especificado'
    });
  }
}
