import { Component, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ProfileService } from '../../../core/services/profile.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FeedbackModalComponent } from '../../../shared/components/feedback-modal/feedback-modal.component';
import { GamificationService } from '../../../core/services/gamification.service';

@Component({
  selector: 'app-profile-avatar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule
  ],
  templateUrl: './profile-avatar.component.html',
  styleUrls: ['./profile-avatar.component.scss']
})
export class ProfileAvatarComponent implements OnInit {
  profileService = inject(ProfileService);
  authService = inject(AuthService);
  supabaseService = inject(SupabaseService);
  gamificationService = inject(GamificationService);
  dialog = inject(MatDialog);

  currentAvatarUrl: string = '';
  userName: string = '';
  isUploading = false;

  firstName: string = '';
  lastName: string = '';
  celular: string = '';
  sexo: string = '';

  newPassword = '';
  confirmPassword = '';

  isSaving = false;
  isChangingPassword = false;

  currentLevel = computed(() => Math.floor(this.gamificationService.totalXp() / 500) + 1);

  get currentUser() {
    return this.authService.currentUser();
  }

  async ngOnInit() {
    const user = this.currentUser;
    if (user) {
      this.userName = user.name || '';
      this.currentAvatarUrl = user.avatar_url || '';

      // Cargar datos de gamificación si es Estudiante
      if (user.role === 'Estudiante') {
        try {
          await this.gamificationService.loadGamificationData();
        } catch (e) {
          console.error('Error loading gamification data:', e);
        }
      }

      try {
        const { data: profile } = await this.supabaseService.supabase
          .from('profiles')
          .select('first_name, last_name, sexo')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile) {
          this.firstName = profile.first_name || '';
          this.lastName = profile.last_name || '';
          this.sexo = profile.sexo || '';
        }

        const { data: userData } = await this.supabaseService.supabase
          .from('users')
          .select('mobile_phone')
          .eq('id', user.id)
          .maybeSingle();

        if (userData) {
          this.celular = userData.mobile_phone || '';
        }
      } catch (e) {
        console.error('Error loading profile details:', e);
      }

      // ponytail: Robust fallback to currentUser signal properties if fields are empty (e.g. offline mode or missing database record)
      if (!this.firstName && user.name && user.name !== 'Usuario') {
        const parts = user.name.split(' ');
        this.firstName = parts[0] || '';
        this.lastName = parts.slice(1).join(' ') || '';
      }
      if (!this.celular && user.mobile_phone) {
        this.celular = user.mobile_phone;
      }
    }
  }

  get userInitial(): string {
    return this.userName ? this.userName.charAt(0).toUpperCase() : 'U';
  }

  async onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;
    
    // Validar tipo y tamaño (< 5MB)
    if (!file.type.startsWith('image/')) {
      this.showFeedback('error', 'Archivo Inválido', 'Por favor selecciona una imagen válida.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.showFeedback('error', 'Archivo Muy Grande', 'La imagen no debe pesar más de 5MB.');
      return;
    }

    const user = this.currentUser;
    if (!user) return;

    this.isUploading = true;

    try {
      const publicUrl = await this.profileService.uploadAvatar(user.id, file);
      if (publicUrl) {
        await this.saveAvatarUrl(publicUrl);
      } else {
        this.showFeedback('error', 'Error', 'Hubo un error al subir la imagen.');
      }
    } catch (e) {
      console.error(e);
      this.showFeedback('error', 'Error de Conexión', 'Error de conexión al subir la imagen.');
    } finally {
      this.isUploading = false;
      event.target.value = ''; // Reset input
    }
  }

  async generateDiceBear() {
    const user = this.currentUser;
    if (!user) return;

    this.isUploading = true;
    
    // Añadir un sufijo aleatorio para cambiar el avatar cada vez que le dé clic
    const seed = `${user.name}-${Math.floor(Math.random() * 1000)}`;
    const diceBearUrl = this.profileService.generateDiceBearAvatar(seed, 'micah');
    
    await this.saveAvatarUrl(diceBearUrl);
    this.isUploading = false;
  }

  private async saveAvatarUrl(url: string) {
    const user = this.currentUser;
    if (!user) return;

    const success = await this.profileService.updateAvatarUrl(user.id, url);
    if (success) {
      this.currentAvatarUrl = url;
      // Actualizar el Signal global
      this.authService.currentUser.set({
        ...user,
        avatar_url: url
      });
    } else {
      this.showFeedback('error', 'Error', 'Error al guardar la URL del avatar en la base de datos.');
    }
  }

  confirmSaveProfile() {
    if (!this.firstName.trim() || !this.lastName.trim()) {
      this.showFeedback('error', 'Datos Incompletos', 'El nombre y el apellido son campos obligatorios.');
      return;
    }

    const dialogRef = this.dialog.open(FeedbackModalComponent, {
      width: '400px',
      data: {
        type: 'confirm',
        title: 'Confirmar Cambios',
        message: '¿Estás seguro que deseas guardar los cambios en tu perfil?',
        btnText: 'Sí, guardar',
        cancelBtnText: 'Cancelar'
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        await this.performSaveProfile();
      }
    });
  }

  async performSaveProfile() {
    const user = this.currentUser;
    if (!user) return;

    this.isSaving = true;
    try {
      // 1. Update profiles table
      const { error: profileError } = await this.supabaseService.supabase
        .from('profiles')
        .update({
          first_name: this.firstName,
          last_name: this.lastName,
          sexo: this.sexo
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // 2. Update users table
      const { error: userError } = await this.supabaseService.supabase
        .from('users')
        .update({
          mobile_phone: this.celular
        })
        .eq('id', user.id);

      if (userError) throw userError;

      const fullName = `${this.firstName.trim()} ${this.lastName.trim()}`.trim();
      this.authService.currentUser.set({
        ...user,
        name: fullName || 'Usuario',
        mobile_phone: this.celular.trim() || undefined
      });
      this.userName = fullName;

      this.showFeedback('success', 'Perfil Guardado', 'Tus datos de perfil han sido actualizados correctamente.');
    } catch (e) {
      console.error(e);
      this.showFeedback('error', 'Error', 'Ocurrió un error al guardar los cambios en tu perfil.');
    } finally {
      this.isSaving = false;
    }
  }

  confirmUpdatePassword() {
    if (!this.newPassword || this.newPassword.length < 6) {
      this.showFeedback('error', 'Contraseña Inválida', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.showFeedback('error', 'Contraseñas No Coinciden', 'La confirmación de la contraseña no coincide con la nueva contraseña.');
      return;
    }

    const dialogRef = this.dialog.open(FeedbackModalComponent, {
      width: '400px',
      data: {
        type: 'confirm',
        title: 'Confirmar Cambio de Contraseña',
        message: '¿Estás seguro que deseas actualizar tu contraseña?',
        btnText: 'Sí, cambiar',
        cancelBtnText: 'Cancelar'
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        await this.performUpdatePassword();
      }
    });
  }

  async performUpdatePassword() {
    this.isChangingPassword = true;
    try {
      const success = await this.authService.updatePassword(this.newPassword);
      if (success) {
        this.newPassword = '';
        this.confirmPassword = '';
        this.showFeedback('success', 'Contraseña Actualizada', 'Tu contraseña ha sido actualizada exitosamente.');
      } else {
        this.showFeedback('error', 'Error', 'No se pudo actualizar la contraseña.');
      }
    } catch (e) {
      console.error(e);
      this.showFeedback('error', 'Error', 'Error de conexión al cambiar la contraseña.');
    } finally {
      this.isChangingPassword = false;
    }
  }

  showFeedback(type: 'success' | 'error', title: string, message: string) {
    this.dialog.open(FeedbackModalComponent, {
      width: '400px',
      data: { type, title, message }
    });
  }
}
