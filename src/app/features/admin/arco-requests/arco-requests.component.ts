import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ArcoService, ArcoRequest } from '../../../core/services/arco.service';
import { FeedbackModalComponent } from '../../../shared/components/feedback-modal/feedback-modal.component';

@Component({
  selector: 'app-arco-requests',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatDialogModule
  ],
  templateUrl: './arco-requests.component.html',
  styleUrl: './arco-requests.component.scss'
})
export class ArcoRequestsComponent implements OnInit {
  private arcoService = inject(ArcoService);
  private dialog = inject(MatDialog);

  loading = signal<boolean>(true);
  requests = signal<ArcoRequest[]>([]);
  
  // Variables de resolución
  selectedRequest = signal<ArcoRequest | null>(null);
  resolutionNotes = '';
  submitting = signal<boolean>(false);

  ngOnInit(): void {
    this.loadRequests();
  }

  async loadRequests() {
    this.loading.set(true);
    const data = await this.arcoService.getAllArcoRequests();
    this.requests.set(data);
    this.loading.set(false);
  }

  selectRequest(req: ArcoRequest) {
    this.selectedRequest.set(req);
    this.resolutionNotes = '';
  }

  async processRequest(status: 'Approved' | 'Rejected' | 'Completed') {
    const req = this.selectedRequest();
    if (!req?.id) return;

    if (!this.resolutionNotes.trim()) {
      alert('Por favor, ingresa las notas de resolución para dar seguimiento formal a la solicitud.');
      return;
    }

    const dialogRef = this.dialog.open(FeedbackModalComponent, {
      width: '400px',
      data: {
        type: 'confirm',
        title: 'Resolver Solicitud',
        message: `¿Estás seguro de marcar esta solicitud como ${status === 'Completed' ? 'Completada' : status === 'Rejected' ? 'Rechazada' : 'Aprobada'}?`,
        btnText: 'Confirmar',
        cancelBtnText: 'Cancelar'
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        this.submitting.set(true);
        const success = await this.arcoService.resolveArcoRequest(
          req.id!,
          status,
          this.resolutionNotes.trim()
        );
        this.submitting.set(false);

        if (success) {
          this.selectedRequest.set(null);
          this.dialog.open(FeedbackModalComponent, {
            width: '400px',
            data: {
              type: 'success',
              title: 'Solicitud Resuelta',
              message: 'La solicitud ARCO ha sido actualizada y registrada con éxito.'
            }
          });
          this.loadRequests();
        } else {
          this.dialog.open(FeedbackModalComponent, {
            width: '400px',
            data: {
              type: 'error',
              title: 'Error',
              message: 'No se pudo resolver la solicitud. Inténtalo de nuevo.'
            }
          });
        }
      }
    });
  }
}
