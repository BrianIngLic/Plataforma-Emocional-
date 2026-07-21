import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ProfileAvatarComponent } from '../../../shared/components/profile-avatar/profile-avatar.component';
import { ArcoSettingsComponent } from '../../../shared/components/arco-settings/arco-settings.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, MatIconModule, ProfileAvatarComponent, ArcoSettingsComponent],
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.scss']
})
export class AdminSettingsComponent {
  private authService = inject(AuthService);
  
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  isSendingLink = false;
  linkSuccessMessage = '';
  linkErrorMessage = '';

  async onRegisterPasskey(): Promise<void> {
    this.isLoading = true;
    this.successMessage = '';
    this.errorMessage = '';
    try {
      await this.authService.registerPasskey();
      this.successMessage = 'Dispositivo Passkey registrado con éxito.';
    } catch (e: any) {
      this.errorMessage = e?.message || 'Error al registrar la Passkey.';
    } finally {
      this.isLoading = false;
    }
  }

  async onSendEnrollmentLink(): Promise<void> {
    this.isSendingLink = true;
    this.linkSuccessMessage = '';
    this.linkErrorMessage = '';
    try {
      const sent = await this.authService.sendEnrollmentLinkForOtherDevice();
      if (sent) {
        this.linkSuccessMessage = 'Se ha enviado un enlace de enrolamiento a tu correo institucional. Abre ese correo en tu nuevo dispositivo.';
      } else {
        this.linkErrorMessage = 'No se pudo enviar el enlace. Verifica la configuración de tu correo.';
      }
    } catch (e: any) {
      this.linkErrorMessage = e?.message || 'Error al enviar el enlace.';
    } finally {
      this.isSendingLink = false;
    }
  }
}
