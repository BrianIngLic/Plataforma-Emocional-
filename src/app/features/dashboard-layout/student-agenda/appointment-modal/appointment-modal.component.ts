import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  dateStr: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'my_reservation';
  id?: string; // appointment id if modifying/canceling
}

@Component({
  selector: 'app-appointment-modal',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
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
              <span class="role">Especialista Asignado</span>
              <span class="name">{{ data.psychologistName || 'Psicólogo Asignado' }}</span>
              <span class="email">{{ data.psychologistEmail || 'contacto@psicologia.buap.mx' }}</span>
            </div>
          </div>
          
          <div class="info-row">
            <mat-icon>location_on</mat-icon>
            <div class="text-block">
              <span class="label">Lugar de Atención</span>
              <span class="value">{{ data.location || 'Consultorio Virtual' }}</span>
            </div>
          </div>

          <div class="info-row">
            <mat-icon>calendar_today</mat-icon>
            <div class="text-block">
              <span class="label">Fecha</span>
              <span class="value">{{ data.dateStr | date:'fullDate' }}</span>
            </div>
          </div>

          <div class="info-row">
            <mat-icon>schedule</mat-icon>
            <div class="text-block">
              <span class="label">Horario</span>
              <span class="value">{{ data.startTime }} - {{ data.endTime }}</span>
            </div>
          </div>
        </div>

        <div class="warning-text" *ngIf="data.status === 'available'">
          Al confirmar, esta hora quedará bloqueada para ti. Recuerda asistir puntualmente.
        </div>
        <div class="warning-text cancel-warning" *ngIf="data.status === 'my_reservation'">
          Si cancelas, perderás este espacio y otro estudiante podrá tomarlo.
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
    .modal-container {
      display: flex;
      flex-direction: column;
      font-family: 'Inter', sans-serif;
    }
    .modal-header {
      background: #f8fafc;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e2e8f0;

      &.is-mine {
        background: #8b5cf6;
        border-bottom-color: #7c3aed;
        h2 { color: white; }
        .close-btn { color: white; opacity: 0.8; &:hover { opacity: 1; color: white; } }
      }

      h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #1e293b;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }
      .close-btn {
        background: transparent; border: none; cursor: pointer; color: #64748b;
        display: flex; align-items: center; justify-content: center;
        &:hover { color: #0f172a; }
      }
    }
    .modal-body {
      padding: 24px;
    }
    .info-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .psychologist-profile-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-bottom: 16px;
      border-bottom: 1px dashed #e2e8f0;
      margin-bottom: 16px;

      .avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #f1f5f9;
        border: 2px solid #8b5cf6;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
        color: #8b5cf6;
        
        img { width: 100%; height: 100%; object-fit: cover; }
        mat-icon { font-size: 32px; width: 32px; height: 32px; opacity: 0.8; }
      }

      .details {
        display: flex;
        flex-direction: column;
        
        .role { font-size: 0.75rem; color: #8b5cf6; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .name { font-size: 1.1rem; color: #0f172a; font-weight: 600; margin-top: 2px; }
        .email { font-size: 0.85rem; color: #64748b; margin-top: 2px; }
      }
    }
    .info-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      mat-icon { color: #8b5cf6; }
      .text-block {
        display: flex;
        flex-direction: column;
        .label { font-size: 0.75rem; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .value { font-size: 1rem; color: #0f172a; font-weight: 500; margin-top: 2px; }
      }
    }
    .warning-text {
      margin-top: 16px;
      font-size: 0.875rem;
      color: #64748b;
      text-align: center;
      background: #f8fafc;
      padding: 12px;
      border-radius: 8px;
    }
    .cancel-warning {
      background: #fef2f2;
      color: #991b1b;
    }
    .modal-footer {
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .btn-primary { background: #8b5cf6; color: white; }
    .btn-danger { background: #ef4444; color: white; }
    button[mat-flat-button] {
      display: flex; align-items: center; gap: 6px; font-weight: 600;
    }
  `]
})
export class AppointmentModalComponent {
  constructor(
    public dialogRef: MatDialogRef<AppointmentModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AppointmentModalData
  ) {}

  close(): void {
    this.dialogRef.close();
  }

  action(): void {
    this.dialogRef.close({ action: this.data.status === 'available' ? 'book' : 'cancel', id: this.data.id });
  }
}
