import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ProfileService } from '../../../core/services/profile.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-profile-avatar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './profile-avatar.component.html',
  styleUrls: ['./profile-avatar.component.scss']
})
export class ProfileAvatarComponent implements OnInit {
  profileService = inject(ProfileService);
  authService = inject(AuthService);

  currentAvatarUrl: string = '';
  userName: string = '';
  isUploading = false;

  get currentUser() {
    return this.authService.currentUser();
  }

  ngOnInit() {
    const user = this.currentUser;
    if (user) {
      this.userName = user.name;
      this.currentAvatarUrl = user.avatar_url || '';
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
      alert('Por favor selecciona una imagen válida.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe pesar más de 5MB.');
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
        alert('Hubo un error al subir la imagen.');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión al subir la imagen.');
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
      alert('Error al guardar la URL del avatar en la base de datos.');
    }
  }
}
