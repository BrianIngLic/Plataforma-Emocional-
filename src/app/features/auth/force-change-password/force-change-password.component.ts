import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-force-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './force-change-password.component.html',
  styleUrls: ['./force-change-password.component.scss']
})
export class ForceChangePasswordComponent {
  private authService = inject(AuthService);
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  newPassword = '';
  confirmPassword = '';
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;

  async onChangePassword() {
    this.errorMessage = '';
    
    if (this.newPassword.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }
    
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden.';
      return;
    }

    this.isSubmitting = true;
    const user = this.authService.currentUser();
    
    if (!user) {
      this.errorMessage = 'No hay sesión activa.';
      this.isSubmitting = false;
      return;
    }

    try {
      // 1. Actualizar contraseña en Auth
      const { error: authError } = await this.supabaseService.supabase.auth.updateUser({
        password: this.newPassword
      });

      if (authError) throw authError;

      // 2. Actualizar bandera en public.users
      const { error: dbError } = await this.supabaseService.supabase
        .from('users')
        .update({ requires_password_change: false })
        .eq('id', user.id);

      if (dbError) throw dbError;

      this.successMessage = '¡Contraseña actualizada con éxito!';
      
      // Actualizar estado local
      this.authService.currentUser.set({ ...user, requires_password_change: false });

      // Redirigir según rol
      setTimeout(() => {
        if (user.role === 'Admin') this.router.navigate(['/admin']);
        else if (user.role === 'Psicologo') this.router.navigate(['/psychologist']);
        else this.router.navigate(['/']);
      }, 1500);

    } catch (e: any) {
      this.errorMessage = e.message || 'Hubo un error al cambiar la contraseña.';
    } finally {
      this.isSubmitting = false;
    }
  }
}
