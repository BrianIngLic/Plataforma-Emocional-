import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../core/services/auth.service';
import { FacultyService, Faculty } from '../../../core/services/faculty.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FeedbackModalComponent } from '../../../shared/components/feedback-modal/feedback-modal.component';

@Component({
  selector: 'app-student-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule],
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

  async saveSettings() {
    const user = this.currentUser;
    if (!user || !this.selectedFaculty) return;

    this.isSaving = true;
    try {
      // Update in profiles
      const { error } = await this.supabaseService.supabase
        .from('profiles')
        .update({ faculty: this.selectedFaculty })
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      this.authService.currentUser.set({
        ...user,
        faculty: this.selectedFaculty
      });

      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { type: 'success', title: 'Ajustes Guardados', message: 'Tu facultad ha sido actualizada correctamente.' }
      });
    } catch (e) {
      console.error(e);
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { type: 'error', title: 'Error', message: 'Ocurrió un problema al guardar tus ajustes.' }
      });
    } finally {
      this.isSaving = false;
    }
  }
}
