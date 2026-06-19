import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AgendaService, WorkingDaysMap } from '../../../core/services/agenda.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  authService = inject(AuthService);
  agendaService = inject(AgendaService);

  sessionDuration: number = 50;
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

  async ngOnInit() {
    await this.loadSettings();
    await this.loadExceptions();
  }

  async loadSettings() {
    if (!this.currentUserId) return;
    const settings = await this.agendaService.getSettings(this.currentUserId);
    if (settings) {
      this.sessionDuration = settings.session_duration;
      const dbDays: WorkingDaysMap = settings.working_days || {};
      
      this.weekDays = this.weekDays.map(day => {
        if (dbDays[day.key]) {
          return { ...day, ...dbDays[day.key] };
        }
        return day;
      });
    }
  }

  async loadExceptions() {
    if (!this.currentUserId) return;
    this.exceptions = await this.agendaService.getExceptions(this.currentUserId);
  }

  async saveSettings() {
    if (!this.currentUserId) return;
    this.isSaving = true;
    
    const workingDaysMap: WorkingDaysMap = {};
    for (const day of this.weekDays) {
      workingDaysMap[day.key] = {
        active: day.active,
        blocks: day.blocks
      };
    }

    try {
      await this.agendaService.saveSettings(this.currentUserId, this.sessionDuration, workingDaysMap);
      this.successMessage = 'Ajustes guardados correctamente.';
      setTimeout(() => this.successMessage = '', 3000);
    } catch (e) {
      console.error(e);
      alert('Error al guardar ajustes');
    }
    this.isSaving = false;
  }

  async addException() {
    if (!this.currentUserId || !this.newExceptionDate) return;
    
    // Validar que no sea fecha pasada por si acaso
    if (this.newExceptionDate < this.today) {
      alert('No puedes bloquear días anteriores a hoy.');
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
    } catch (e) {
      console.error(e);
      alert('Error al añadir excepción');
    }
  }

  async deleteException(id: string) {
    try {
      await this.agendaService.deleteException(id);
      this.exceptions = this.exceptions.filter(e => e.id !== id);
    } catch (e) {
      console.error(e);
      alert('Error al eliminar excepción');
    }
  }

  addTimeBlock(day: any) {
    day.blocks.push({ start: '16:00', end: '19:00' });
  }

  removeTimeBlock(day: any, index: number) {
    day.blocks.splice(index, 1);
  }
}
