import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../core/services/auth.service';
import { FacultyService, Faculty } from '../../../core/services/faculty.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ClinicalService } from '../../../core/services/clinical.service';
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
  clinicalService = inject(ClinicalService);
  dialog = inject(MatDialog);

  faculties: Faculty[] = [];
  selectedFaculty: string = '';
  isSaving = false;

  hasPsychologist = false;
  hasNutritionist = false;
  inPsychologistQueue = false;
  inNutritionistQueue = false;

  get currentUser() {
    return this.authService.currentUser();
  }

  async ngOnInit() {
    this.faculties = await this.facultyService.getFaculties();
    const user = this.currentUser;
    if (user) {
      if (user.faculty) this.selectedFaculty = user.faculty;

      // Cargar estatus de especialistas y fila virtual
      const { data: rec } = await this.supabaseService.supabase
        .from('student_clinical_records')
        .select('primary_psychologist_id, primary_nutritionist_id')
        .eq('student_id', user.id)
        .maybeSingle();

      if (rec) {
        this.hasPsychologist = !!rec.primary_psychologist_id;
        this.hasNutritionist = !!rec.primary_nutritionist_id;
      }

      const { data: queue } = await this.supabaseService.supabase
        .from('virtual_queue')
        .select('specialty')
        .eq('student_id', user.id);

      if (queue) {
        queue.forEach((q: any) => {
          if (q.specialty === 'psychologist') this.inPsychologistQueue = true;
          if (q.specialty === 'nutritionist') this.inNutritionistQueue = true;
        });
      }
    }
  }

  async solicitarEspecialista(specialty: 'psychologist' | 'nutritionist') {
    const user = this.currentUser;
    if (!user || !user.id) return;
    
    if (!this.selectedFaculty) {
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { 
          type: 'error', 
          title: 'Facultad Requerida', 
          message: 'Por favor selecciona y guarda tu facultad primero para poder asignarte un especialista de tu área.' 
        }
      });
      return;
    }

    this.isSaving = true;
    try {
      const roleId = specialty === 'psychologist' ? 3 : 4;
      const assignedId = await this.clinicalService.getSpecialistWithLeastLoad(roleId, user.id);
      
      if (assignedId) {
        const field = specialty === 'psychologist' ? 'primary_psychologist_id' : 'primary_nutritionist_id';
        const { data: existing } = await this.supabaseService.supabase
          .from('student_clinical_records')
          .select('student_id')
          .eq('student_id', user.id)
          .maybeSingle();

        if (existing) {
          await this.supabaseService.supabase
            .from('student_clinical_records')
            .update({ [field]: assignedId })
            .eq('student_id', user.id);
        } else {
          await this.supabaseService.supabase
            .from('student_clinical_records')
            .insert({
              student_id: user.id,
              [field]: assignedId,
              known_conditions: ['Test_Completado'],
              consent_given: true
            });
        }

        if (specialty === 'psychologist') this.hasPsychologist = true;
        else this.hasNutritionist = true;

        this.dialog.open(FeedbackModalComponent, {
          width: '400px',
          data: { 
            type: 'success', 
            title: 'Asignación Exitosa', 
            message: `Se te ha asignado un ${specialty === 'psychologist' ? 'psicólogo' : 'nutriólogo'} de tu facultad exitosamente.` 
          }
        });
      } else {
        const { error: queueErr } = await this.supabaseService.supabase
          .from('virtual_queue')
          .insert({
            student_id: user.id,
            specialty: specialty,
            faculty: this.selectedFaculty
          });

        if (specialty === 'psychologist') this.inPsychologistQueue = true;
        else this.inNutritionistQueue = true;

        this.dialog.open(FeedbackModalComponent, {
          width: '400px',
          data: { 
            type: 'success', 
            title: 'Fila de Espera', 
            message: `Todos los especialistas de tu facultad están saturados. Has sido colocado en la fila de espera virtual.` 
          }
        });
      }
    } catch (e) {
      console.error(e);
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { type: 'error', title: 'Error', message: 'No se pudo procesar la solicitud de asignación.' }
      });
    } finally {
      this.isSaving = false;
    }
  }

  confirmSave() {
    if (!this.selectedFaculty) return;

    const dialogRef = this.dialog.open(FeedbackModalComponent, {
      width: '400px',
      data: {
        type: 'confirm',
        title: 'Confirmar Cambio',
        message: '¿Estás seguro que deseas guardar los cambios en tu facultad académica?',
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
      if (this.selectedFaculty) updatePayload.faculty = this.selectedFaculty;

      const { error } = await this.supabaseService.supabase
        .from('profiles')
        .update(updatePayload)
        .eq('user_id', user.id);

      this.isSaving = false;

      if (!error) {
        this.authService.currentUser.set({
          ...user,
          faculty: this.selectedFaculty || user.faculty
        });

        this.dialog.open(FeedbackModalComponent, {
          width: '400px',
          data: { type: 'success', title: 'Datos Guardados', message: 'Tus datos académicos han sido actualizados correctamente.' }
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
