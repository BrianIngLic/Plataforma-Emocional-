import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ArcoService, PrivacySettings, ArcoRequest } from '../../../core/services/arco.service';
import { AuthService } from '../../../core/services/auth.service';
import { FeedbackModalComponent } from '../feedback-modal/feedback-modal.component';

@Component({
  selector: 'app-arco-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatInputModule,
    MatTabsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule
  ],
  templateUrl: './arco-settings.component.html',
  styleUrl: './arco-settings.component.scss'
})
export class ArcoSettingsComponent implements OnInit {
  private arcoService = inject(ArcoService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);

  userRole = signal<string>('Estudiante');

  // Carga
  loadingSettings = signal<boolean>(true);
  submittingPrivacy = signal<boolean>(false);
  submittingRequest = signal<boolean>(false);
  exportingData = signal<boolean>(false);

  // Estados de privacidad (Oposición)
  shareClinicalData = signal<boolean>(true);
  useAnonymousStats = signal<boolean>(true);

  // Solicitudes ARCO
  myRequests = signal<ArcoRequest[]>([]);

  // Formulario de Solicitudes
  arcoForm = this.fb.group({
    type: ['Cancellation', Validators.required],
    details: ['', [Validators.required, Validators.minLength(15)]]
  });

  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) {
      this.userRole.set(user.role);
    }
    this.loadPrivacyAndRequests();
  }

  async loadPrivacyAndRequests() {
    this.loadingSettings.set(true);
    
    // Cargar configuraciones de privacidad
    const settings = await this.arcoService.getPrivacySettings();
    if (settings) {
      this.shareClinicalData.set(settings.share_clinical_data);
      this.useAnonymousStats.set(settings.use_anonymous_stats);
    }

    // Cargar solicitudes previas
    const requests = await this.arcoService.getMyArcoRequests();
    this.myRequests.set(requests);

    this.loadingSettings.set(false);
  }

  async onPrivacyChange() {
    this.submittingPrivacy.set(true);
    const success = await this.arcoService.updatePrivacySettings(
      this.shareClinicalData(),
      this.useAnonymousStats()
    );
    this.submittingPrivacy.set(false);

    if (success) {
      this.showSuccess('Preferencias de privacidad actualizadas con éxito.');
    } else {
      this.showError('Error al guardar preferencias de privacidad.');
    }
  }

  async downloadMyData() {
    this.exportingData.set(true);
    await this.arcoService.exportUserData();
    this.exportingData.set(false);
  }

  async onSubmitRequest() {
    if (this.arcoForm.invalid) return;

    this.submittingRequest.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    const type = this.arcoForm.value.type as any;
    const details = this.arcoForm.value.details || '';

    const success = await this.arcoService.submitArcoRequest(type, details);
    this.submittingRequest.set(false);

    if (success) {
      this.showSuccess('Tu solicitud ARCO ha sido enviada exitosamente al equipo administrador.');
      this.arcoForm.reset({ type: 'Cancellation', details: '' });
      // Recargar historial
      const requests = await this.arcoService.getMyArcoRequests();
      this.myRequests.set(requests);
    } else {
      this.showError('Ocurrió un error al enviar tu solicitud. Inténtalo de nuevo.');
    }
  }

  private showSuccess(msg: string) {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 5000);
  }

  private showError(msg: string) {
    this.errorMessage.set(msg);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }

  confirmDeleteAccount() {
    const dialogRef = this.dialog.open(FeedbackModalComponent, {
      width: '420px',
      data: {
        type: 'confirm',
        title: '⚠️ Eliminar Cuenta',
        message: '¿Estás seguro que deseas eliminar tu cuenta permanentemente? Esta acción borrará todo tu historial, diario emocional y datos clínicos de forma irreversible.',
        btnText: 'Sí, eliminar cuenta',
        cancelBtnText: 'Cancelar'
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        this.loadingSettings.set(true);
        const success = await this.arcoService.deleteUserAccount();
        this.loadingSettings.set(false);
        if (!success) {
          this.showError('Ocurrió un error al intentar eliminar la cuenta. Inténtalo más tarde.');
        } else {
          this.dialog.open(FeedbackModalComponent, {
            width: '400px',
            data: {
              type: 'success',
              title: 'Cuenta Eliminada',
              message: 'Tu cuenta ha sido eliminada exitosamente. Se han purgado todos tus datos personales.',
              btnText: 'Entendido'
            }
          });
        }
      }
    });
  }
}
