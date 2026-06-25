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

@Component({
  selector: 'app-student-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatDialogModule, ProfileAvatarComponent],
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
  isSaving = false;

  get currentUser() {
    return this.authService.currentUser();
  }

  async ngOnInit() {
    this.faculties = await this.facultyService.getFaculties();
    const user = this.currentUser;
    if (user && user.faculty) {
      this.selectedFaculty = user.faculty;
    }
  }

  confirmSave() {
    if (!this.selectedFaculty) return;

    const dialogRef = this.dialog.open(FeedbackModalComponent, {
      width: '400px',
      data: {
        type: 'confirm',
        title: 'Confirmar Cambio',
        message: '¿Estás seguro que deseas cambiar tu facultad? Esto podría afectar la lista de especialistas disponibles para ti.',
        btnText: 'Sí, cambiar',
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
      const { error } = await this.supabaseService.supabase
        .from('profiles')
        .update({ faculty: this.selectedFaculty })
        .eq('user_id', user.id);
        
      this.isSaving = false;

      if (!error) {
        this.authService.currentUser.set({
          ...user,
          faculty: this.selectedFaculty
        });

        this.dialog.open(FeedbackModalComponent, {
          width: '400px',
          data: { type: 'success', title: 'Ajustes Guardados', message: 'Tu facultad ha sido actualizada correctamente.' }
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
