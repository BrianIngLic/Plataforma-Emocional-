import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { QuillModule } from 'ngx-quill';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CryptoService } from '../../../core/services/crypto.service';

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
        <div class="sheet-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <!-- Izquierda: Logo Institucional y Título del Documento -->
          <div class="logo-area" style="display: flex; align-items: center; gap: 0.75rem;">
            <img *ngIf="institutionalLogoUrl" [src]="institutionalLogoUrl" alt="Logo Institucional" style="max-height: 54px; max-width: 130px; object-fit: contain;" />
            <div>
              <div class="doc-title" style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); letter-spacing: 0.5px; margin-bottom: 0.25rem;">NOTA DE EVOLUCIÓN CLÍNICA</div>
              <div style="font-size: 0.9rem; color: #64748b; font-weight: 500;">Expediente Clínico del Estudiante</div>
            </div>
          </div>
          
          <!-- Derecha: Logo de Amati, Fecha y Estatus -->
          <div style="display: flex; align-items: center; gap: 1.5rem;">
            <div class="date-area" style="text-align: right;">
              <p style="margin: 0.15rem 0;"><strong>Fecha de Emisión:</strong> {{ currentDate | date:'dd - MM - yyyy' }}</p>
              <p style="margin: 0.15rem 0;"><strong>Estatus:</strong> 
                <span class="status-badge" [ngStyle]="{'background': isReadOnly ? '#bbf7d0' : '#fef08a', 'color': isReadOnly ? '#166534' : '#854d0e'}">
                  {{ isReadOnly ? 'Finalizada' : 'Borrador' }}
                </span>
              </p>
            </div>
            <div class="logo" style="display: flex; align-items: center; gap: 0.35rem; font-size: 1.4rem; font-weight: 800; color: var(--text-primary);">
              <img src="/amati-logo.svg" alt="Amati" style="width: 28px; height: 28px;" /> Amati
            </div>
          </div>
        </div>

        <hr class="divider">

        <div *ngIf="loading" class="amati-loading-container">
          <div class="amati-loader-wrapper">
            <div class="spinner-ring"></div>
            <img src="/amati-logo.svg" alt="Amati Logo" class="amati-logo-pulse" />
          </div>
          <h3 class="loading-title">Cargando expediente...</h3>
          <p class="loading-subtitle">Accediendo a notas clínicas e historial confidencial</p>
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
                  <td>{{ patient.student_id?.substring(0,8)?.toUpperCase() }}</td>
                </tr>
                <tr>
                  <th>Matrícula:</th>
                  <td>{{ patient.matricula }}</td>
                  <th>Facultad:</th>
                  <td>{{ patient.faculty }}</td>
                </tr>
                <tr>
                  <th>Celular:</th>
                  <td>{{ patient.celular }}</td>
                  <th>Sexo:</th>
                  <td>{{ patient.sexo }}</td>
                </tr>
                <tr>
                  <th>Fecha de Nacimiento:</th>
                  <td>{{ patient.fecha_nacimiento }}</td>
                  <th>Edad:</th>
                  <td>{{ patient.edad }}</td>
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
  crypto = inject(CryptoService);
  location = inject(Location);
  route = inject(ActivatedRoute);
  router = inject(Router);

  appointmentId: string = '';
  appointment: any = null;
  patient: any = null;
  loading = true;
  isReadOnly = false;

  currentDate = new Date();
  institutionalLogoUrl: string | null = null;

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
          .select('id, matricula, profiles(first_name, last_name, faculty), student_clinical_records!student_clinical_records_student_id_fkey(additional_notes)')
          .eq('id', this.appointment.student_id)
          .single();
          
        if (pError) throw pError;
        if (pData) {
          const profile = Array.isArray(pData.profiles) ? pData.profiles[0] : pData.profiles;
          const records = pData.student_clinical_records;
          const recordObj = Array.isArray(records) ? records[0] : records;
          
          let matricula = pData.matricula || 'N/A';
          let faculty = profile?.faculty || 'N/A';
          let celular = 'N/A';
          let sexo = 'N/A';
          let fechaNacimiento = 'N/A';
          let edad = 'N/A';

          if (recordObj && recordObj.additional_notes) {
            try {
              const decrypted = this.crypto.decrypt(recordObj.additional_notes);
              const parsed = JSON.parse(decrypted);
              const gen = parsed.general_data || {};
              celular = gen.celular || 'N/A';
              sexo = gen.sexo || 'N/A';
              fechaNacimiento = gen.fecha_nacimiento || 'N/A';
              edad = gen.edad ? `${gen.edad} años` : 'N/A';
            } catch(e) {
              console.warn('Error decrypting notes for general data:', e);
            }
          }

          this.patient = {
            student_id: pData.id,
            first_name: profile?.first_name || 'Paciente',
            last_name: profile?.last_name || 'Sin Nombre',
            matricula: matricula,
            faculty: faculty,
            celular: celular,
            sexo: sexo,
            fecha_nacimiento: fechaNacimiento,
            edad: edad
          };
        }
      }

      // Fetch institutional logo URL
      const { data: assetData } = this.supabase.storage
        .from('institutional_assets')
        .getPublicUrl('watermark_logo.png');

      if (assetData) {
        this.institutionalLogoUrl = assetData.publicUrl;
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
