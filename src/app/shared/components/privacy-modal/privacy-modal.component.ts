import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-privacy-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="privacy-modal-overlay" *ngIf="show" (click)="onClose()">
      <div class="privacy-modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Aviso de Privacidad del Sistema</h2>
          <button class="close-btn" (click)="onClose()">✖</button>
        </div>
        <div class="modal-content">
          <ng-content></ng-content>
          <p><strong>Plataforma de Asistencia Emocional con IA</strong> ... (texto completo del aviso)</p>
        </div>
        <div class="modal-footer">
          <button (click)="onClose()" class="btn-primary">Cerrar y Entendido</button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./privacy-modal.component.scss'] 
})
export class PrivacyModalComponent {
  @Input() show = false;
  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }
}
