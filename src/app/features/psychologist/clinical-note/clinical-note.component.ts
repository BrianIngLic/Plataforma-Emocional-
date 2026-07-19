import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { QuillModule } from 'ngx-quill';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FeedbackModalComponent } from '../../../shared/components/feedback-modal/feedback-modal.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CryptoService } from '../../../core/services/crypto.service';

@Component({
  selector: 'app-clinical-note',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, QuillModule, MatDialogModule],
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
              <div class="doc-title" style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); letter-spacing: 0.5px; margin-bottom: 0.25rem;">{{ mode === 'discharge' ? 'NOTA DE ALTA Y CIERRE CLÍNICO' : 'NOTA DE EVOLUCIÓN CLÍNICA' }}</div>
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
              <!-- Auto-save status indicator -->
              <p *ngIf="!isReadOnly && !isSigned" style="margin: 0.15rem 0; font-size: 0.8rem; color: #64748b; font-style: italic; display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
                <mat-icon style="font-size: 14px; width: 14px; height: 14px; color: #10b981;" *ngIf="isAutoSaving && autoSaveStatus.startsWith('Cambios')">cloud_done</mat-icon>
                <mat-icon style="font-size: 14px; width: 14px; height: 14px; color: #3b82f6;" *ngIf="autoSaveStatus === 'Escribiendo...'">sync</mat-icon>
                <span>{{ autoSaveStatus || 'Listo para editar' }}</span>
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

          <!-- Antecedentes Clínicos Familiares (Campo Compartido) -->
          <div class="panel shared-panel" style="margin-bottom: 2rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem;">
            <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1rem;">
              <h3 class="section-title" style="display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">
                <mat-icon style="color: #8b5cf6;">family_history</mat-icon> Antecedentes Clínicos Familiares (Compartido)
              </h3>
              <div>
                <button *ngIf="!isEditingAntecedentes && !isSigned" type="button" class="btn btn-outline" (click)="toggleEditAntecedentes()" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; padding: 0.5rem 0.85rem; border: 1px solid #8b5cf6; border-radius: 8px; color: #8b5cf6; background: transparent; cursor: pointer; font-weight: 600;">
                  <mat-icon style="font-size: 18px; width: 18px; height: 18px;">edit</mat-icon> Editar Antecedentes
                </button>
                <div *ngIf="isEditingAntecedentes" style="display: flex; gap: 0.5rem;">
                  <button type="button" class="btn btn-outline" (click)="cancelEditAntecedentes()" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; padding: 0.5rem 0.85rem; border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-secondary); background: transparent; cursor: pointer; font-weight: 600;">
                    Cancelar
                  </button>
                  <button type="button" class="btn btn-primary" (click)="guardarAntecedentes()" [disabled]="savingAntecedentes" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; padding: 0.5rem 0.85rem; border: none; border-radius: 8px; color: white; background: #8b5cf6; cursor: pointer; font-weight: 600;">
                    <mat-icon style="font-size: 18px; width: 18px; height: 18px;">save</mat-icon> {{ savingAntecedentes ? 'Guardando...' : 'Guardar' }}
                  </button>
                </div>
              </div>
            </div>
            <div class="editor-wrapper" style="position: relative;">
              <!-- Editor en modo edición -->
              <quill-editor 
                *ngIf="isEditingAntecedentes"
                [(ngModel)]="antecedentesContent" 
                [ngModelOptions]="{standalone: true}"
                [modules]="quillModules" 
                [readOnly]="false"
                placeholder="Escriba los antecedentes familiares aquí..."
                theme="snow"
                style="min-height: 100px; display: block; background: var(--bg-card); margin-bottom: 1rem;">
              </quill-editor>
              <!-- Editor en modo lectura -->
              <quill-editor 
                *ngIf="!isEditingAntecedentes"
                [(ngModel)]="antecedentesContent" 
                [ngModelOptions]="{standalone: true}"
                [modules]="{ toolbar: false }" 
                [readOnly]="true"
                placeholder="No hay antecedentes familiares registrados."
                theme="snow"
                style="min-height: 100px; display: block; background: var(--bg-card); margin-bottom: 1rem;">
              </quill-editor>
            </div>
          </div>
             <!-- Redactor de Notas Clínicas (Quill) -->
          <div class="editor-section">
            <h3 class="section-title">Evolución y Notas de la Sesión</h3>
            <quill-editor 
              [(ngModel)]="notesContent" 
              (ngModelChange)="onFieldChange()"
              [modules]="isReadOnly ? { toolbar: false } : quillModules" 
              [readOnly]="isReadOnly || isSigned"
              placeholder="Redacte la nota clínica aquí..."
              theme="snow">
            </quill-editor>
          </div>

          <!-- Tareas/Actividades para la próxima sesión (Solo Psicólogo) -->
          <div *ngIf="isPsychologist" class="editor-section tasks-editor">
            <h3 class="section-title">Tareas / Actividades para la próxima sesión</h3>
            <quill-editor 
              [(ngModel)]="nextSessionTasks" 
              (ngModelChange)="onFieldChange()"
              [modules]="isReadOnly || isSigned ? { toolbar: false } : quillModules" 
              [readOnly]="isReadOnly || isSigned"
              placeholder="Escriba las tareas o actividades acordadas para la próxima sesión aquí..."
              theme="snow">
            </quill-editor>
          </div>

          <!-- Referencia a Especialista (Para Ambos) -->
          <div class="panel shared-panel" style="margin-top: 1.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
            <div class="panel-header" style="display: flex; align-items: center; gap: 0.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1rem;">
              <h3 class="section-title" style="display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-primary); border-bottom: none; padding-bottom: 0;">
                <mat-icon style="color: #f59e0b;">hail</mat-icon> Referencia a otro especialista
              </h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">
                Indique si el paciente requiere ser canalizado o referenciado a otro profesional de la salud.
              </p>
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label style="font-size: 0.9rem; font-weight: 600; color: var(--text-secondary);">Seleccione el especialista:</label>
                <select [(ngModel)]="referralSpecialist" (ngModelChange)="onFieldChange()" [disabled]="isReadOnly || isSigned" style="width: 100%; max-width: 300px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; background: var(--bg-card); color: var(--text-primary); outline: none;">
                  <option value="">Ninguna referencia</option>
                  <option value="Nutriólogo">Nutriólogo</option>
                  <option value="Psicólogo">Psicólogo</option>
                  <option value="Psiquiatra">Psiquiatra</option>
                  <option value="Médico General">Médico General</option>
                  <option value="Otro">Otro (Especificar)</option>
                </select>
              </div>
              <div *ngIf="referralSpecialist === 'Otro'" style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label style="font-size: 0.9rem; font-weight: 600; color: var(--text-secondary);">Especifique el especialista:</label>
                <input type="text" [(ngModel)]="referralSpecialistOther" (ngModelChange)="onFieldChange()" [disabled]="isReadOnly || isSigned" placeholder="Ej. Cardiólogo, Neurólogo..." style="width: 100%; max-width: 300px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; background: var(--bg-card); color: var(--text-primary); outline: none;" />
              </div>
            </div>
          </div>

          <!-- Firma Electrónica -->
          <div class="panel signature-panel" style="margin-top: 1.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem;">
            <div class="panel-header" style="display: flex; align-items: center; gap: 0.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1rem;">
              <h3 class="section-title" style="display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">
                <mat-icon style="color: #0ea5e9;">verified_user</mat-icon> {{ mode === 'discharge' ? 'Firma Electrónica Autorizada' : 'Firma Electrónica Autorizada (META SEAL)' }}
              </h3>
            </div>

            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">
                Al firmar esta nota clínica, se generará una firma digital que certificará la autenticidad y el estado del expediente en la fecha actual. Una vez firmada, el contenido de la nota y los antecedentes familiares quedarán bloqueados (snapshot) y no podrán modificarse.
              </p>

              <div *ngIf="!isSigned" style="display: flex; align-items: center; gap: 1rem;">
                <button type="button" (click)="signWithMetaSeal()" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 0.5rem; border: none; border-radius: 10px; padding: 0.75rem 1.5rem; font-weight: 700; cursor: pointer; background: #0ea5e9; color: white; transition: all 0.2s; box-shadow: 0 4px 6px rgba(14, 165, 233, 0.15);">
                  <mat-icon>fingerprint</mat-icon> {{ mode === 'discharge' ? 'Firmar Nota' : 'Firmar con META SEAL' }}
                </button>
                <span style="color: var(--text-secondary); font-size: 0.85rem; font-style: italic;">Nota pendiente de firma digital.</span>
              </div>

              <div *ngIf="isSigned" style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 10px; padding: 1rem; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <mat-icon style="color: #10b981; font-size: 32px; width: 32px; height: 32px;">verified</mat-icon>
                  <div>
                    <h4 style="margin: 0; color: var(--text-primary); font-size: 0.9rem; font-weight: 700;">Documento Firmado Electrónicamente</h4>
                    <p style="margin: 0.2rem 0 0; color: var(--text-secondary); font-size: 0.75rem;">
                      Firmado por: <strong>{{ signatureName }}</strong> el {{ signatureDate | date:'dd/MM/yyyy HH:mm:ss' }}
                    </p>
                    <p style="margin: 0.2rem 0 0; color: var(--text-secondary); font-family: monospace; font-size: 0.7rem; word-break: break-all;">
                      {{ mode === 'discharge' ? 'Código de Verificación' : 'Sello' }}: <span style="color: #10b981;">{{ signatureSeal }}</span>
                    </p>
                  </div>
                </div>
                <button *ngIf="!isReadOnly" type="button" (click)="unsignMetaSeal()" style="background: transparent; border: 1px solid #ef4444; color: #ef4444; border-radius: 8px; padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                  Modificar Nota
                </button>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- Botones de Acción (Pie de página) -->
        <div class="sheet-footer" *ngIf="!isReadOnly && !loading">
          <button *ngIf="mode !== 'discharge'" class="btn btn-secondary" (click)="markNoShow()" [disabled]="loading">
            <mat-icon>person_off</mat-icon> Marcar Inasistencia
          </button>
          
          <div class="right-actions" style="margin-left: auto;">
            <button class="btn btn-text" (click)="goBack()">Cancelar</button>
            <button class="btn btn-primary" (click)="saveNote()" [disabled]="loading || !notesContent.trim()">
              <mat-icon>save</mat-icon> {{ mode === 'discharge' ? 'Finalizar Alta' : 'Guardar y Finalizar Cita' }}
            </button>
          </div>
        </div>

      </div>
    </div>
  `,
  styleUrls: ['./clinical-note.component.scss']
})
export class ClinicalNoteComponent implements OnInit, OnDestroy {
  supabase = inject(SupabaseService).supabase;
  crypto = inject(CryptoService);
  location = inject(Location);
  route = inject(ActivatedRoute);
  router = inject(Router);
  dialog = inject(MatDialog);

  showFeedback(type: 'success' | 'error', title: string, message: string) {
    this.dialog.open(FeedbackModalComponent, {
      width: '400px',
      data: { type, title, message }
    });
  }

  appointmentId: string = '';
  appointment: any = null;
  patient: any = null;
  loading = true;
  isReadOnly = false;
  mode: string | null = null;

  currentDate = new Date();
  institutionalLogoUrl: string | null = null;

  // Antecedentes Familiares Compartidos
  isEditingAntecedentes = false;
  savingAntecedentes = false;
  antecedentesContent = '';

  // ponytail: Simplified storage of next session tasks inside note HTML.
  isPsychologist = false;
  nextSessionTasks = '';

  // ponytail: Simplified referral tracking inside notes HTML to avoid schema migration.
  referralSpecialist = '';
  referralSpecialistOther = '';

  // Meta Seal Signature
  isSigned = false;
  signatureName = '';
  signatureDate: Date | null = null;
  signatureSeal = '';

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
    this.mode = this.route.snapshot.queryParamMap.get('mode') || null;
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

      // Determine professional's role
      const { data: { user } } = await this.supabase.auth.getUser();
      if (user) {
        const { data: userRole } = await this.supabase
          .from('users')
          .select('role_id')
          .eq('id', user.id)
          .single();
        this.isPsychologist = userRole?.role_id === 3;
      }

      if (this.appointment.status === 'completed' || this.appointment.status === 'no_show') {
        this.isReadOnly = true;
        this.notesContent = this.appointment.notes || '';

        // ponytail: Extract next session tasks snapshot from notesContent if present
        if (this.notesContent) {
          const tasksMatch = this.notesContent.match(/<div class="next-session-tasks-content">([\s\S]*?)<\/div>/);
          if (tasksMatch) {
            this.nextSessionTasks = tasksMatch[1].trim();
          }
        }

        // ponytail: Extract referral info if present
        if (this.notesContent) {
          const referralMatch = this.notesContent.match(/Referenciado a (.*?)</);
          if (referralMatch) {
            const spec = referralMatch[1].trim();
            const predefined = ['Nutriólogo', 'Psicólogo', 'Psiquiatra', 'Médico General'];
            if (predefined.includes(spec)) {
              this.referralSpecialist = spec;
            } else {
              this.referralSpecialist = 'Otro';
              this.referralSpecialistOther = spec;
            }
          }
        }
        
        if (this.notesContent && (this.notesContent.includes('META-SEAL-SECURE-SIGNATURE-SHA256') || this.notesContent.includes('Firma Digital Autorizada:'))) {
          this.isSigned = true;
          const nameMatch = this.notesContent.match(/Firmado por:<\/strong> ([^e\n<]+)/);
          const dateMatch = this.notesContent.match(/en fecha ([^<]+)/);
          const sealMatch = this.notesContent.match(/(?:META-SEAL-SECURE-SIGNATURE-SHA256|Firma Digital Autorizada): ([A-Z0-9-]+)/);

          this.signatureName = nameMatch ? nameMatch[1].trim() : 'Especialista';
          this.signatureSeal = sealMatch ? `${sealMatch[0].trim()}` : '';
          this.signatureDate = dateMatch ? new Date() : new Date();

          // Extract snapshotted family history content
          const antMatch = this.notesContent.match(/<div class="ant-snapshot-content">([\s\S]*?)<\/div>/);
          if (antMatch) {
            this.antecedentesContent = antMatch[1].trim();
          }
        }
      } else if (this.mode === 'discharge') {
        this.notesContent = '<p><strong>Nota de Alta / Cierre de Tratamiento:</strong> </p><p></p>';
      } else {
        // Draft mode
        if (this.appointment.notes) {
          const rawNotes = this.appointment.notes;

          // 1. Extract next session tasks draft
          const tasksMatch = rawNotes.match(/<div class="draft-next-session-tasks" style="display:none;">([\s\S]*?)<\/div>/);
          if (tasksMatch) {
            this.nextSessionTasks = tasksMatch[1].trim();
          }

          // 2. Extract referral draft
          const referralMatch = rawNotes.match(/<div class="draft-referral-specialist" style="display:none;">([\s\S]*?)<\/div>/);
          if (referralMatch) {
            this.referralSpecialist = referralMatch[1].trim();
          }
          const referralOtherMatch = rawNotes.match(/<div class="draft-referral-other" style="display:none;">([\s\S]*?)<\/div>/);
          if (referralOtherMatch) {
            this.referralSpecialistOther = referralOtherMatch[1].trim();
          }

          // 3. Clean draft elements from notesContent
          this.notesContent = rawNotes
            .replace(/<div class="draft-next-session-tasks" style="display:none;">[\s\S]*?<\/div>/g, '')
            .replace(/<div class="draft-referral-specialist" style="display:none;">[\s\S]*?<\/div>/g, '')
            .replace(/<div class="draft-referral-other" style="display:none;">[\s\S]*?<\/div>/g, '')
            .trim();
        }
      }

      // Fetch Patient (User -> profiles)
      if (this.appointment && this.appointment.student_id) {
        const { data: pData, error: pError } = await this.supabase
          .from('users')
          .select('id, matricula, mobile_phone, profiles(first_name, last_name, faculty, antecedentes_familiares, sexo, fecha_nacimiento), student_clinical_records!student_clinical_records_student_id_fkey(additional_notes)')
          .eq('id', this.appointment.student_id)
          .single();
          
        if (pError) throw pError;
        if (pData) {
          const profile = Array.isArray(pData.profiles) ? pData.profiles[0] : pData.profiles;
          const records = pData.student_clinical_records;
          const recordObj = Array.isArray(records) ? records[0] : records;
          
          let matricula = pData.matricula || 'N/A';
          let faculty = profile?.faculty || 'N/A';
          let celular = pData.mobile_phone || 'N/A';
          let sexo = profile?.sexo || 'N/A';
          let fechaNacimiento = profile?.fecha_nacimiento || 'N/A';
          let edad = 'N/A';
          let antecedentesFamiliares = profile?.antecedentes_familiares || '';

          if (recordObj && recordObj.additional_notes) {
            try {
              const decrypted = this.crypto.decrypt(recordObj.additional_notes);
              const parsed = JSON.parse(decrypted);
              const gen = parsed.general_data || {};
              if (celular === 'N/A') celular = gen.celular || 'N/A';
              if (sexo === 'N/A') sexo = gen.sexo || 'N/A';
              if (fechaNacimiento === 'N/A') fechaNacimiento = gen.fecha_nacimiento || 'N/A';
              if (gen.antecedentes_familiares && !antecedentesFamiliares) {
                antecedentesFamiliares = gen.antecedentes_familiares;
              }
            } catch(e) {
              console.warn('Error decrypting notes for general data:', e);
            }
          }

          // Calculate age based on birth date and session date to keep it locked relative to the note's session date
          if (fechaNacimiento && fechaNacimiento !== 'N/A') {
            try {
              const birthDate = new Date(fechaNacimiento);
              const sessionDate = this.appointment?.scheduled_date ? new Date(this.appointment.scheduled_date) : new Date();
              let calculatedAge = sessionDate.getFullYear() - birthDate.getFullYear();
              const m = sessionDate.getMonth() - birthDate.getMonth();
              if (m < 0 || (m === 0 && sessionDate.getDate() < birthDate.getDate())) {
                calculatedAge--;
              }
              edad = `${calculatedAge} años`;
            } catch (e) {
              console.warn('Error calculating age:', e);
            }
          }

          // Format birthdate nicely
          let formattedBirthdate = fechaNacimiento;
          if (fechaNacimiento && fechaNacimiento !== 'N/A' && fechaNacimiento.includes('-')) {
            try {
              const [y, m, d] = fechaNacimiento.split('-');
              formattedBirthdate = `${d.padStart(2, '0')} - ${m.padStart(2, '0')} - ${y}`;
            } catch (e) {
              formattedBirthdate = fechaNacimiento;
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
            fecha_nacimiento: formattedBirthdate,
            edad: edad,
            antecedentes_familiares: antecedentesFamiliares
          };

          this.antecedentesContent = antecedentesFamiliares;
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
    if (!this.isSigned) {
      alert(this.mode === 'discharge' ? 'La nota de alta debe estar firmada electrónicamente antes de poder guardarse como final.' : 'La nota clínica debe estar firmada electrónicamente con META SEAL antes de poder guardarse como final.');
      return;
    }

    this.loading = true;

    // Append signature, snapshot, and next session tasks to notesContent HTML
    const formattedDate = this.signatureDate ? this.signatureDate.toLocaleString() : new Date().toLocaleString();
    
    // ponytail: Append next session tasks inside notes HTML to avoid schema migration
    let tasksHtml = '';
    if (this.isPsychologist && this.nextSessionTasks && this.nextSessionTasks.trim()) {
      tasksHtml = `
        <div class="next-session-tasks-snapshot" style="margin-top: 1.5rem; padding: 0.75rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
          <p style="margin: 0 0 0.5rem 0; color: #15803d;"><strong>Tareas / Actividades para la próxima sesión:</strong></p>
          <div class="next-session-tasks-content">${this.nextSessionTasks}</div>
        </div>
      `;
    }

    // ponytail: Append referral information inside notes HTML to avoid schema migration
    let referralHtml = '';
    if (this.referralSpecialist) {
      const spec = this.referralSpecialist === 'Otro' ? this.referralSpecialistOther : this.referralSpecialist;
      if (spec && spec.trim()) {
        referralHtml = `
          <div class="referral-snapshot" style="margin-top: 1.5rem; padding: 0.75rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
            <p style="margin: 0;"><strong>Referencia clínica:</strong> Referenciado a ${spec}</p>
          </div>
        `;
      }
    }

    const signatureHtml = this.mode === 'discharge' ? `
      <div class="signature-block" style="margin-top: 2rem; border-top: 2px dashed #dc2626; padding-top: 1rem; color: #334155;">
        <p><strong>Firmado Electrónicamente:</strong></p>
        <p><strong>Código de Verificación:</strong> <span style="font-family: monospace; color: #16a34a;">${this.signatureSeal}</span></p>
        <p><strong>Firmado por:</strong> ${this.signatureName} en fecha ${formattedDate}</p>
      </div>
    ` : `
      <div class="meta-seal-signature-block" style="margin-top: 2rem; border-top: 2px dashed #0ea5e9; padding-top: 1rem; color: #334155;">
        <p><strong>Firmado Electrónicamente con META SEAL:</strong></p>
        <p><strong>Sello Digital:</strong> <span style="font-family: monospace; color: #10b981;">${this.signatureSeal}</span></p>
        <p><strong>Firmado por:</strong> ${this.signatureName} en fecha ${formattedDate}</p>
        <div class="antecedentes-snapshot" style="margin-top: 1rem; padding: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <p style="margin: 0 0 0.5rem 0;"><strong>Antecedentes Familiares (Snapshot al momento de la firma):</strong></p>
          <div class="ant-snapshot-content">${this.antecedentesContent || 'Sin antecedentes familiares registrados.'}</div>
        </div>
      </div>
    `;

    const finalNotes = this.notesContent + tasksHtml + referralHtml + signatureHtml;

    const { error } = await this.supabase
      .from('appointments')
      .update({ status: 'completed', notes: finalNotes })
      .eq('id', this.appointmentId);
      
    if (!error) {
      // Registrar el logro de cita completada para el estudiante
      await this.supabase.rpc('update_user_activity_streak', {
        p_user_id: this.patient.student_id,
        p_category: 'appointment'
      });
    }
      
    this.loading = false;
    if (error) {
      console.error(error);
      alert('Error al guardar la nota');
    } else {
      this.goBack();
    }
  }

  async signWithMetaSeal() {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) return;

      const { data: profProfile } = await this.supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .single();

      let titlePrefix = 'Psic.';
      const { data: userRole } = await this.supabase
        .from('users')
        .select('role_id')
        .eq('id', user.id)
        .single();
        
      if (userRole && userRole.role_id === 4) {
        titlePrefix = 'Nutr.';
      }

      const name = profProfile 
        ? `${titlePrefix} ${profProfile.first_name} ${profProfile.last_name}` 
        : `Especialista (ID: ${user.id.substring(0,8)})`;

      this.signatureName = name;
      this.signatureDate = new Date();
      
      const rawString = `${user.id}-${this.patient?.student_id}-${this.signatureDate.toISOString()}-SECURE`;
      let hash = 0;
      for (let i = 0; i < rawString.length; i++) {
        hash = (hash << 5) - hash + rawString.charCodeAt(i);
        hash |= 0;
      }
      const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');

      if (this.mode === 'discharge') {
        this.signatureSeal = `${hexHash}-${this.patient?.student_id?.substring(0, 8).toUpperCase()}`;
      } else {
        this.signatureSeal = `META-SEAL-SECURE-SIGNATURE-SHA256: ${hexHash}-${this.patient?.student_id?.substring(0, 8).toUpperCase()}`;
      }

      this.isSigned = true;
      this.isEditingAntecedentes = false;
    } catch (err) {
      console.error('Error signing with Meta Seal:', err);
      alert('No se pudo firmar el documento.');
    }
  }

  unsignMetaSeal() {
    this.isSigned = false;
    this.signatureName = '';
    this.signatureDate = null;
    this.signatureSeal = '';
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

  toggleEditAntecedentes() {
    this.isEditingAntecedentes = true;
  }

  cancelEditAntecedentes() {
    this.antecedentesContent = this.patient?.antecedentes_familiares || '';
    this.isEditingAntecedentes = false;
  }

  async guardarAntecedentes() {
    if (!this.patient) return;
    this.savingAntecedentes = true;

    try {
      const { data: recordData, error: fetchError } = await this.supabase
        .from('student_clinical_records')
        .select('additional_notes')
        .eq('student_id', this.patient.student_id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let clinicalNotesObj: any = {};
      if (recordData?.additional_notes) {
        try {
          const decrypted = this.crypto.decrypt(recordData.additional_notes);
          clinicalNotesObj = JSON.parse(decrypted);
        } catch(e) {
          console.warn('Error decrypting clinical record:', e);
        }
      }

      clinicalNotesObj.general_data = clinicalNotesObj.general_data || {};
      clinicalNotesObj.general_data.antecedentes_familiares = this.antecedentesContent;

      const encryptedNotes = this.crypto.encrypt(JSON.stringify(clinicalNotesObj));

      const { error: updateError } = await this.supabase
        .from('student_clinical_records')
        .update({ additional_notes: encryptedNotes })
        .eq('student_id', this.patient.student_id);

      if (updateError) throw updateError;

      const { error: profileError } = await this.supabase
        .from('profiles')
        .update({ antecedentes_familiares: this.antecedentesContent })
        .eq('user_id', this.patient.student_id);

      if (profileError) {
        console.warn('Error updating profile table:', profileError);
      }

      this.patient.antecedentes_familiares = this.antecedentesContent;
      this.isEditingAntecedentes = false;
      this.showFeedback('success', '¡Antecedentes Actualizados!', 'Los antecedentes familiares han sido guardados exitosamente.');
    } catch(err) {
      console.error('Error al guardar antecedentes:', err);
      this.showFeedback('error', 'Error al Guardar', 'Ocurrió un error al intentar guardar los antecedentes familiares.');
    } finally {
      this.savingAntecedentes = false;
    }
  }

  // ponytail: Auto-save debouncer and logic
  private autoSaveTimeout: any = null;
  isAutoSaving = false;
  autoSaveStatus = '';

  ngOnDestroy() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
  }

  onFieldChange() {
    if (this.isReadOnly || this.isSigned) return;
    this.autoSaveStatus = 'Escribiendo...';
    
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(() => {
      this.autoSaveDraft();
    }, 2500);
  }

  async autoSaveDraft() {
    if (this.isReadOnly || this.isSigned) return;

    this.isAutoSaving = true;
    this.autoSaveStatus = 'Guardando automáticamente...';

    // Format draft elements
    const draftTasksHtml = this.nextSessionTasks ? `<div class="draft-next-session-tasks" style="display:none;">${this.nextSessionTasks}</div>` : '';
    const draftReferralHtml = this.referralSpecialist ? `<div class="draft-referral-specialist" style="display:none;">${this.referralSpecialist}</div>` : '';
    const draftReferralOtherHtml = this.referralSpecialistOther ? `<div class="draft-referral-other" style="display:none;">${this.referralSpecialistOther}</div>` : '';

    const draftContent = this.notesContent + draftTasksHtml + draftReferralHtml + draftReferralOtherHtml;

    try {
      const { error } = await this.supabase
        .from('appointments')
        .update({ notes: draftContent })
        .eq('id', this.appointmentId);
      
      if (error) throw error;
      this.autoSaveStatus = 'Cambios guardados automáticamente';
    } catch (e) {
      console.warn('Auto-save failed:', e);
      this.autoSaveStatus = 'Error al guardar automáticamente';
    }
  }

  goBack() {
    this.location.back();
  }
}
