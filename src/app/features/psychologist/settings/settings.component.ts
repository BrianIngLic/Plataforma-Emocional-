import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AgendaService, WorkingDaysMap } from '../../../core/services/agenda.service';
import { AuthService } from '../../../core/services/auth.service';
import { FeedbackModalComponent } from '../../../shared/components/feedback-modal/feedback-modal.component';
import { FacultyService, Faculty } from '../../../core/services/faculty.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ProfileAvatarComponent } from '../../../shared/components/profile-avatar/profile-avatar.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule, ProfileAvatarComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  authService = inject(AuthService);
  agendaService = inject(AgendaService);
  facultyService = inject(FacultyService);
  supabaseService = inject(SupabaseService);
  dialog = inject(MatDialog);

  activeTab: 'perfil' | 'agenda' = 'perfil';
  faculties: Faculty[] = [];
  selectedFaculty: string = '';

  sessionDuration: number = 50;
  location: string = '';
  modality: 'virtual' | 'presencial' = 'virtual';
  selectedFacultyId: any = null;
  building: string = '';
  officeRoom: string = '';
  today = new Date().toISOString().split('T')[0];
  
  weekDays = [
    { key: 'monday', label: 'Lunes', active: true, blocks: [{start: '09:00', end: '17:00'}] },
    { key: 'tuesday', label: 'Martes', active: true, blocks: [{start: '09:00', end: '17:00'}] },
    { key: 'wednesday', label: 'Miércoles', active: true, blocks: [{start: '09:00', end: '17:00'}] },
    { key: 'thursday', label: 'Jueves', active: true, blocks: [{start: '09:00', end: '17:00'}] },
    { key: 'friday', label: 'Viernes', active: true, blocks: [{start: '09:00', end: '17:00'}] },
    { key: 'saturday', label: 'Sábado', active: false, blocks: [{start: '09:00', end: '13:00'}] },
    { key: 'sunday', label: 'Domingo', active: false, blocks: [{start: '09:00', end: '13:00'}] }
  ];

  exceptions: any[] = [];
  newExceptionDate: string = '';
  newExceptionDesc: string = '';
  newExceptionIsFullDay: boolean = true;
  newExceptionStartTime: string = '09:00';
  newExceptionEndTime: string = '12:00';

  isSaving = false;
  successMessage = '';

  get currentUserId() { return this.authService.currentUser()?.id; }

  get upcomingExceptions() {
    return this.exceptions.filter(e => e.exception_date >= this.today);
  }

  setTab(tab: 'perfil' | 'agenda') {
    this.activeTab = tab;
  }

  async ngOnInit() {
    this.faculties = await this.facultyService.getFaculties();
    const user = this.authService.currentUser();
    if (user && user.faculty) {
      this.selectedFaculty = user.faculty;
    }

    await this.loadSettings();
    await this.loadExceptions();
  }

  async loadSettings() {
    if (!this.currentUserId) return;
    const settings = await this.agendaService.getSettings(this.currentUserId);
    if (settings) {
      this.sessionDuration = settings.session_duration;
      this.location = settings.location || '';
      this.modality = settings.modality || 'virtual';
      this.selectedFacultyId = settings.faculty_id || null;
      this.building = settings.building || '';
      this.officeRoom = settings.office_room || '';
      
      if (!this.selectedFacultyId && this.selectedFaculty) {
        const match = this.faculties.find(f => f.name === this.selectedFaculty);
        if (match) this.selectedFacultyId = match.id;
      }

      const dbDays: WorkingDaysMap = settings.working_days || {};
      
      this.weekDays = this.weekDays.map(day => {
        if (dbDays[day.key]) {
          return { ...day, ...dbDays[day.key] };
        }
        return day;
      });
    } else if (this.selectedFaculty) {
      const match = this.faculties.find(f => f.name === this.selectedFaculty);
      if (match) this.selectedFacultyId = match.id;
    }
  }

  async loadExceptions() {
    if (!this.currentUserId) return;
    this.exceptions = await this.agendaService.getExceptions(this.currentUserId);
  }

  async saveSettings() {
    if (!this.currentUserId) return;
    
    // Guardar la facultad en el perfil del psicólogo
    if (this.selectedFaculty) {
      await this.supabaseService.supabase
        .from('profiles')
        .update({ faculty: this.selectedFaculty })
        .eq('user_id', this.currentUserId);
        
      const currentUser = this.authService.currentUser();
      if (currentUser) {
        this.authService.currentUser.set({ ...currentUser, faculty: this.selectedFaculty });
      }
    }
    
    // Validación de bloques de tiempo
    for (const day of this.weekDays) {
      if (day.active) {
        for (const block of day.blocks) {
          if (!block.start || !block.end) {
            this.showFeedback('error', 'Horario Inválido', `Por favor completa las horas en el día ${day.label}.`);
            return;
          }
          if (block.start >= block.end) {
            this.showFeedback('error', 'Horario Inválido', `En el día ${day.label}, la hora de inicio (${block.start}) no puede ser igual o posterior a la hora de fin (${block.end}).`);
            return;
          }
        }
      }
    }

    this.isSaving = true;
    
    const workingDaysMap: WorkingDaysMap = {};
    for (const day of this.weekDays) {
      workingDaysMap[day.key] = {
        active: day.active,
        blocks: day.blocks
      };
    }

    try {
      await this.agendaService.saveSettings(this.currentUserId, this.sessionDuration, workingDaysMap, this.location, this.modality, this.selectedFacultyId ? Number(this.selectedFacultyId) : null, this.building, this.officeRoom);
      this.showFeedback('success', '¡Ajustes Guardados!', 'Tus horarios y lugar de atención han sido actualizados exitosamente.');
    } catch (e) {
      console.error(e);
      this.showFeedback('error', 'Error', 'Ocurrió un error al guardar los ajustes.');
    }
    this.isSaving = false;
  }

  async addException() {
    if (!this.currentUserId || !this.newExceptionDate) return;
    
    // Validar que no sea fecha pasada por si acaso
    if (this.newExceptionDate < this.today) {
      this.showFeedback('error', 'Fecha Inválida', 'No puedes bloquear días anteriores a hoy.');
      return;
    }

    try {
      const sTime = this.newExceptionIsFullDay ? undefined : this.newExceptionStartTime;
      const eTime = this.newExceptionIsFullDay ? undefined : this.newExceptionEndTime;

      const added = await this.agendaService.addException(
        this.currentUserId, 
        this.newExceptionDate, 
        this.newExceptionDesc || 'Día bloqueado',
        sTime,
        eTime
      );
      this.exceptions.push(added);
      // Sort
      this.exceptions.sort((a, b) => new Date(a.exception_date).getTime() - new Date(b.exception_date).getTime());
      
      this.newExceptionDate = '';
      this.newExceptionDesc = '';
      this.newExceptionIsFullDay = true;
      this.showFeedback('success', 'Día Bloqueado', 'La excepción ha sido añadida a tu agenda.');
    } catch (e) {
      console.error(e);
      this.showFeedback('error', 'Error', 'Ocurrió un error al añadir el bloqueo.');
    }
  }

  async deleteException(id: string) {
    try {
      await this.agendaService.deleteException(id);
      this.exceptions = this.exceptions.filter(e => e.id !== id);
      this.showFeedback('success', 'Bloqueo Eliminado', 'El día ha sido desbloqueado de tu agenda.');
    } catch (e) {
      console.error(e);
      this.showFeedback('error', 'Error', 'No se pudo eliminar el bloqueo.');
    }
  }

  addTimeBlock(day: any) {
    day.blocks.push({ start: '16:00', end: '19:00' });
  }

  removeTimeBlock(day: any, index: number) {
    day.blocks.splice(index, 1);
  }

  showFeedback(type: 'success' | 'error', title: string, message: string) {
    this.dialog.open(FeedbackModalComponent, {
      width: '400px',
      data: { type, title, message }
    });
  }
}
