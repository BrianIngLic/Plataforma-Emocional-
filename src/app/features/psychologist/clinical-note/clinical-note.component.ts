import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { QuillModule } from 'ngx-quill';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-clinical-note',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, QuillModule],
  template: `
    <div class="page-container">
      <!-- Barra superior de navegación -->
      <div class="top-nav">
        <button class="back-btn" (click)="goBack()">
          <mat-icon>arrow_back</mat-icon> Volver al Expediente
        </button>
      </div>

      <!-- Hoja Clínica (Contenedor principal) -->
      <div class="clinical-sheet">
        
        <!-- Membrete / Encabezado -->
        <div class="sheet-header">
          <div class="logo-area">
            <div class="logo">
              <span class="logo-icon">🧠</span> EmolA
            </div>
            <div class="doc-title">NOTA DE EVOLUCIÓN CLÍNICA</div>
          </div>
          <div class="date-area">
            <p><strong>Fecha de Emisión:</strong> {{ currentDate | date:'dd - MM - yyyy' }}</p>
            <p><strong>Estatus:</strong> 
              <span class="status-badge" [ngStyle]="{'background': isReadOnly ? '#bbf7d0' : '#fef08a', 'color': isReadOnly ? '#166534' : '#854d0e'}">
                {{ isReadOnly ? 'Finalizada' : 'Borrador' }}
              </span>
            </p>
          </div>
        </div>

        <hr class="divider">

        <div *ngIf="loading" class="loading-state">
          <mat-icon class="spinner">autorenew</mat-icon> Cargando expediente...
        </div>

        <ng-container *ngIf="!loading && appointment && patient">
          <!-- Datos de Identificación (Tabla) -->
          <div class="info-section">
            <h3 class="section-title">Datos de Identificación del Paciente</h3>
            <table class="info-table">
              <tbody>
                <tr>
                  <th>Nombre Completo:</th>
                  <td>{{ patient.first_name }} {{ patient.last_name }}</td>
                  <th>Expediente / ID:</th>
                  <td>{{ patient.student_id.substring(0,8).toUpperCase() }}</td>
                </tr>
                <tr>
                  <th>Fecha de Sesión:</th>
                  <td>{{ appointment.formatted_date }}</td>
                  <th>Horario:</th>
                  <td>{{ appointment.start_time.substring(0,5) }} - {{ appointment.end_time.substring(0,5) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Redactor de Notas Clínicas (Quill) -->
          <div class="editor-section">
            <h3 class="section-title">Evolución y Notas de la Sesión</h3>
            <quill-editor 
              [(ngModel)]="notesContent" 
              [modules]="isReadOnly ? { toolbar: false } : quillModules" 
              [readOnly]="isReadOnly"
              placeholder="Redacte la nota clínica aquí..."
              theme="snow">
            </quill-editor>
          </div>
        </ng-container>

        <!-- Botones de Acción (Pie de página) -->
        <div class="sheet-footer" *ngIf="!isReadOnly && !loading">
          <button class="btn btn-secondary" (click)="markNoShow()" [disabled]="loading">
            <mat-icon>person_off</mat-icon> Marcar Inasistencia
          </button>
          
          <div class="right-actions">
            <button class="btn btn-text" (click)="goBack()">Cancelar</button>
            <button class="btn btn-primary" (click)="saveNote()" [disabled]="loading || !notesContent.trim()">
              <mat-icon>save</mat-icon> Guardar y Finalizar Cita
            </button>
          </div>
        </div>

      </div>
    </div>
  `,
  styleUrls: ['./clinical-note.component.scss']
})
export class ClinicalNoteComponent implements OnInit {
  supabase = inject(SupabaseService).supabase;
  location = inject(Location);
  route = inject(ActivatedRoute);
  router = inject(Router);

  appointmentId: string = '';
  appointment: any = null;
  patient: any = null;
  loading = true;
  isReadOnly = false;

  currentDate = new Date();

  // Plantilla SOAP pre-llenada en HTML
  notesContent = `
    <p><strong>S (Subjetivo):</strong> </p>
    <p><br></p>
    <p><strong>O (Objetivo):</strong> </p>
    <p><br></p>
    <p><strong>A (Análisis/Evaluación):</strong> </p>
    <p><br></p>
    <p><strong>P (Plan):</strong> </p>
  `;

  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
      [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
      [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
      ['clean']                                         // remove formatting button
    ]
  };

  async ngOnInit() {
    this.appointmentId = this.route.snapshot.paramMap.get('id') || '';
    if (this.appointmentId) {
      await this.loadData();
    }
  }

  async loadData() {
    this.loading = true;
    try {
      // Fetch Appointment
      const { data: appt, error: apptError } = await this.supabase
        .from('appointments')
        .select('*')
        .eq('id', this.appointmentId)
        .single();
        
      if (apptError) throw apptError;
      this.appointment = appt;

      if (this.appointment.status === 'completed' || this.appointment.status === 'no_show') {
        this.isReadOnly = true;
        this.notesContent = this.appointment.notes;
      }

      // Fetch Patient (User -> profiles)
      if (this.appointment && this.appointment.student_id) {
        const { data: pData, error: pError } = await this.supabase
          .from('users')
          .select('id, profiles(first_name, last_name)')
          .eq('id', this.appointment.student_id)
          .single();
          
        if (pError) throw pError;
        if (pData && pData.profiles) {
          const profile = Array.isArray(pData.profiles) ? pData.profiles[0] : pData.profiles;
          this.patient = {
            student_id: pData.id,
            first_name: profile.first_name,
            last_name: profile.last_name
          };
        }
      }
      
      // Formatear fecha
      if (this.appointment && this.appointment.scheduled_date) {
        const d = new Date(this.appointment.scheduled_date.substring(0, 10) + 'T12:00:00');
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        this.appointment.formatted_date = `${day} - ${month} - ${year}`;
      }
      
    } catch (err) {
      console.error('Error loading data:', err);
    }
    this.loading = false;
  }

  async saveNote() {
    this.loading = true;
    const { error } = await this.supabase
      .from('appointments')
      .update({ status: 'completed', notes: this.notesContent })
      .eq('id', this.appointmentId);
      
    this.loading = false;
    if (error) {
      console.error(error);
      alert('Error al guardar la nota');
    } else {
      this.goBack();
    }
  }

  async markNoShow() {
    if (!confirm('¿Estás seguro de marcar esta cita como Inasistencia?')) return;
    
    this.loading = true;
    const { error } = await this.supabase
      .from('appointments')
      .update({ status: 'no_show', notes: '<p><strong>Inasistencia:</strong> El paciente no se presentó a la sesión.</p>' })
      .eq('id', this.appointmentId);
      
    this.loading = false;
    if (error) {
      console.error(error);
      alert('Error al actualizar');
    } else {
      this.goBack();
    }
  }

  goBack() {
    this.location.back();
  }
}
