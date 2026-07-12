import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../core/services/auth.service';
import { FacultyService, Faculty } from '../../../core/services/faculty.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FeedbackModalComponent } from '../../../shared/components/feedback-modal/feedback-modal.component';
import { ProfileAvatarComponent } from '../../../shared/components/profile-avatar/profile-avatar.component';
import { ArcoSettingsComponent } from '../../../shared/components/arco-settings/arco-settings.component';

@Component({
  selector: 'app-student-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    ProfileAvatarComponent,
    ArcoSettingsComponent
  ],
  templateUrl: './student-settings.component.html',
  styleUrls: ['./student-settings.component.scss']
})
export class StudentSettingsComponent implements OnInit {
  authService = inject(AuthService);
  facultyService = inject(FacultyService);
  supabaseService = inject(SupabaseService);
  dialog = inject(MatDialog);

  faculties: Faculty[] = [];
  selectedFaculty: string = '';
  firstName: string = '';
  lastName: string = '';
  isSaving = false;

  get currentUser() {
    return this.authService.currentUser();
  }

  async ngOnInit() {
    this.faculties = await this.facultyService.getFaculties();
    const user = this.currentUser;
    if (user) {
      if (user.faculty) this.selectedFaculty = user.faculty;
      // Separar el nombre completo en nombre y apellido
      const parts = (user.name && user.name !== 'Usuario') ? user.name.split(' ') : [];
      this.firstName = parts[0] || '';
      this.lastName = parts.slice(1).join(' ') || '';
    }
  }

  confirmSave() {
    if (!this.selectedFaculty && !this.firstName && !this.lastName) return;

    const dialogRef = this.dialog.open(FeedbackModalComponent, {
      width: '400px',
      data: {
        type: 'confirm',
        title: 'Confirmar Cambio',
        message: '¿Estás seguro que deseas guardar los cambios en tu perfil?',
        btnText: 'Sí, guardar',
        cancelBtnText: 'Cancelar'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.performSave();
      }
    });
  }

  async performSave() {
    this.isSaving = true;
    const user = this.authService.currentUser();

    if (user && user.id) {
      const updatePayload: any = {};
      if (this.selectedFaculty) updatePayload.faculty    = this.selectedFaculty;
      if (this.firstName !== undefined) updatePayload.first_name = this.firstName.trim();
      if (this.lastName  !== undefined) updatePayload.last_name  = this.lastName.trim();

      const { error } = await this.supabaseService.supabase
        .from('profiles')
        .update(updatePayload)
        .eq('user_id', user.id);

      this.isSaving = false;

      if (!error) {
        const fullName = `${this.firstName.trim()} ${this.lastName.trim()}`.trim();
        this.authService.currentUser.set({
          ...user,
          faculty: this.selectedFaculty || user.faculty,
          name: fullName || user.name
        });

        this.dialog.open(FeedbackModalComponent, {
          width: '400px',
          data: { type: 'success', title: 'Perfil Guardado', message: 'Tus datos han sido actualizados correctamente.' }
        });
      } else {
        this.dialog.open(FeedbackModalComponent, {
          width: '400px',
          data: { type: 'error', title: 'Error', message: 'No se pudo guardar la configuración.' }
        });
      }
    } else {
      this.isSaving = false;
    }
  }
}
