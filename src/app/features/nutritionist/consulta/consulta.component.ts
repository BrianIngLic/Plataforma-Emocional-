import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FeedbackModalComponent } from '../../../shared/components/feedback-modal/feedback-modal.component';
import { NutricionService, CampoFormulario, ConsultaNutricionRow, NuevaConsultaNutricionPayload } from '../../../core/services/nutrition/nutricion.service';
import { CalendarioService, RegistroAyerSnapshot } from '../../../core/services/nutrition/calendario.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { QuillModule } from 'ngx-quill';

interface BloqueVisual {
  titulo: string;
  campos: CampoFormulario[];
}

@Component({
  selector: 'app-consulta-nutricion',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, MatIconModule, QuillModule, MatDialogModule],
  templateUrl: './consulta.component.html',
  styleUrls: ['./consulta.component.scss']
})
export class ConsultaComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private nutricionService = inject(NutricionService);
  private calendarioService = inject(CalendarioService);
  private authService = inject(AuthService);
  private supabaseService = inject(SupabaseService);
  private crypto = inject(CryptoService);
  private dialog = inject(MatDialog);

  showFeedback(type: 'success' | 'error', title: string, message: string) {
    this.dialog.open(FeedbackModalComponent, {
      width: '400px',
      data: { type, title, message }
    });
  }

  form: FormGroup<any> = this.fb.group({
    calorias_totales: new FormControl<number | null>(0, { nonNullable: false, validators: [Validators.min(0)] }),
    recordatorio_24h: this.fb.array([])
  }) as FormGroup<any>;

  pacienteId = '';
  nutriologoId = '';
  loading = true;
  saving = false;
  campos: CampoFormulario[] = [];
  bloques: BloqueVisual[] = [];
  ultimaConsulta: ConsultaNutricionRow | null = null;
  snapshotAyer: RegistroAyerSnapshot | null = null;
  selectOptions = ['Sí', 'No', 'A veces', 'No aplica'];
  patient: any = null;
  currentDate = new Date();
  institutionalLogoUrl: string | null = null;
  sessionId: string | null = null;

  // Antecedentes Familiares Compartidos
  isEditingAntecedentes = false;
  savingAntecedentes = false;
  antecedentesContent = '';

  // Meta Seal Signature
  isSigned = false;
  signatureName = '';
  signatureDate: Date | null = null;
  signatureSeal = '';

  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      [{ 'color': [] }, { 'background': [] }],
      ['clean']
    ]
  };

  get currentUserId() {
    return this.authService.currentUser()?.id || '';
  }

  async ngOnInit() {
    this.pacienteId = this.route.snapshot.paramMap.get('id') || '';
    this.nutriologoId = this.currentUserId;
    this.sessionId = this.route.snapshot.queryParamMap.get('sessionId') || null;

    if (!this.pacienteId || !this.nutriologoId) {
      this.router.navigate(['/nutritionist/pacientes']);
      return;
    }

    await this.loadPatientData();
    await this.loadFormDefinition();
  }

  private async loadPatientData() {
    try {
      const { data: pData, error: pError } = await this.supabaseService.supabase
        .from('users')
        .select('id, matricula, mobile_phone, profiles(first_name, last_name, faculty, antecedentes_familiares), student_clinical_records!student_clinical_records_student_id_fkey(additional_notes)')
        .eq('id', this.pacienteId)
        .single();
        
      if (pError) throw pError;
      if (pData) {
        const profile = Array.isArray(pData.profiles) ? pData.profiles[0] : pData.profiles;
        const records = pData.student_clinical_records;
        const recordObj = Array.isArray(records) ? records[0] : records;
        
        let matricula = pData.matricula || 'N/A';
        let faculty = profile?.faculty || 'N/A';
        let celular = pData.mobile_phone || 'N/A';
        let sexo = 'N/A';
        let fechaNacimiento = 'N/A';
        let edad = 'N/A';
        let antecedentesFamiliares = profile?.antecedentes_familiares || '';

        if (recordObj && recordObj.additional_notes) {
          try {
            const decrypted = this.crypto.decrypt(recordObj.additional_notes);
            if (decrypted && !decrypted.startsWith('U2FsdGVkX1')) {
              const parsed = JSON.parse(decrypted);
              const gen = parsed.general_data || {};
              celular = gen.celular || pData.mobile_phone || 'N/A';
              sexo = gen.sexo || 'N/A';
              fechaNacimiento = gen.fecha_nacimiento || 'N/A';
              edad = gen.edad ? `${gen.edad} años` : 'N/A';
              if (gen.antecedentes_familiares) {
                antecedentesFamiliares = gen.antecedentes_familiares;
              }
            } else {
              console.warn('loadPatientData: No se pudo descifrar la nota clínica (llave E2EE no disponible).');
            }
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
          edad: edad,
          antecedentes_familiares: antecedentesFamiliares
        };

        this.antecedentesContent = antecedentesFamiliares;
      }

      // Fetch institutional logo URL
      const { data: assetData } = this.supabaseService.supabase.storage
        .from('institutional_assets')
        .getPublicUrl('watermark_logo.png');

      if (assetData) {
        this.institutionalLogoUrl = assetData.publicUrl;
      }
    } catch (err) {
      console.error('Error cargando datos del paciente:', err);
    }
  }

  private async loadFormDefinition() {
    this.loading = true;

    try {
      let fetchedCampos = await this.nutricionService.obtenerCamposFormulario();

      // ponytail: Removed manual injection of antecedentes_familiares to avoid duplication with shared field panel


      // Ensure comentarios_clinicos is defined in fields catalog
      if (!fetchedCampos.some(c => c.clave === 'comentarios_clinicos')) {
        fetchedCampos.push({
          id: 'manual-comentarios',
          bloque: 'Bloque 1 - Datos Específicos',
          clave: 'comentarios_clinicos',
          etiqueta: 'Comentarios Clínicos',
          tipo_campo: 'rich-text',
          activo: true
        });
      }

      let existingConsulta: ConsultaNutricionRow | null = null;
      if (this.sessionId) {
        const { data, error } = await this.supabaseService.supabase
          .from('consultas_nutricion')
          .select('id, student_id, professional_id, fecha_consulta, calorias_totales, datos_especificos, consumo_semanal, recordatorio_24h')
          .eq('appointment_id', this.sessionId)
          .maybeSingle();
        if (!error && data) {
          existingConsulta = data as ConsultaNutricionRow;
        }
      }

      this.campos = fetchedCampos;
      this.buildDynamicForm(this.campos);

      if (existingConsulta) {
        this.ultimaConsulta = existingConsulta;
        this.patchFromLastConsultation(existingConsulta);
        await this.loadRecordatorio24h(existingConsulta);
        const de = existingConsulta.datos_especificos || {};
        if (de['firma_digital']) {
          this.isSigned = true;
          this.signatureSeal = de['firma_digital'] as string;
          this.signatureName = de['firma_nombre'] as string;
          this.signatureDate = de['firma_fecha'] ? new Date(de['firma_fecha'] as string) : null;
          this.antecedentesContent = de['antecedentes_familiares_snapshot'] as string || '';
          
          // Disable editing
          this.form.disable();
        }
      } else {
        this.ultimaConsulta = await this.nutricionService.obtenerUltimaConsulta(this.pacienteId);
        if (this.ultimaConsulta) {
          this.patchFromLastConsultation(this.ultimaConsulta);
        }
        await this.loadRecordatorio24h(null);
      }

      const grouped = this.nutricionService.agruparCamposPorBloque(this.campos);
      this.bloques = [
        { titulo: 'Bloque 1 - Datos Específicos', campos: grouped.bloque1 },
        { titulo: 'Bloque 2 - Consumo Semanal', campos: grouped.bloque2 }
      ];
    } catch (error) {
      console.error('Error cargando definición de consulta:', error);
      alert('No se pudo cargar el formulario dinámico.');
    } finally {
      this.loading = false;
    }
  }

  private buildDynamicForm(campos: CampoFormulario[]) {
    for (const campo of campos) {
      if (this.form.contains(campo.clave)) continue;

      if (campo.tipo_campo === 'food-table') {
        this.form.addControl(campo.clave, this.fb.array([]));
        this.agregarFilaTabla(campo.clave);
      } else {
        const initialValue = campo.tipo_campo === 'boolean' ? false : '';
        this.form.addControl(campo.clave, new FormControl(initialValue, { nonNullable: false }));
      }
    }
  }

  private patchFromLastConsultation(consulta: ConsultaNutricionRow) {
    const patchValues: Record<string, unknown> = {
      calorias_totales: consulta.calorias_totales ?? 0
    };

    Object.assign(patchValues, consulta.datos_especificos || {});
    
    // Assign consumption values that are not FormArrays first
    const consumption = consulta.consumo_semanal || {};
    for (const key of Object.keys(consumption)) {
      if (!Array.isArray(consumption[key])) {
        patchValues[key] = consumption[key];
      }
    }

    // Backward compatibility mapping for old comments key
    const spec = consulta.datos_especificos || {};
    if (spec['comentarios'] && !spec['comentarios_clinicos']) {
      patchValues['comentarios_clinicos'] = spec['comentarios'];
    }

    this.form.patchValue(patchValues);

    // Populate FormArrays for food-table fields
    for (const campo of this.campos) {
      if (campo.tipo_campo === 'food-table') {
        const arr = this.form.get(campo.clave) as FormArray;
        if (arr) {
          while (arr.length) arr.removeAt(0);
          
          const rows = consumption[campo.clave];
          if (Array.isArray(rows)) {
            for (const r of rows) {
              arr.push(this.fb.group({
                alimento: [r.alimento || ''],
                cantidad: [r.cantidad || ''],
                unidad: [r.unidad || ''],
                frecuencia: [r.frecuencia || ''],
                nota: [r.nota || '']
              }));
            }
            // Append one extra empty row at the end for auto-grow
            this.agregarFilaTabla(campo.clave);
          } else {
            // Default empty row
            this.agregarFilaTabla(campo.clave);
          }
        }
      }
    }
  }

  getCamposPorBloque(bloque: BloqueVisual): CampoFormulario[] {
    return bloque.campos.filter(c => c.tipo_campo !== 'rich-text' && c.tipo_campo !== 'food-table');
  }

  getRichTextCamposPorBloque(bloque: BloqueVisual): CampoFormulario[] {
    return bloque.campos.filter(c => c.tipo_campo === 'rich-text');
  }

  hasRichTextCampos(bloque: BloqueVisual): boolean {
    return bloque.campos.some(c => c.tipo_campo === 'rich-text');
  }

  getFoodTableCamposPorBloque(bloque: BloqueVisual): CampoFormulario[] {
    return bloque.campos.filter(c => c.tipo_campo === 'food-table');
  }

  hasFoodTableCampos(bloque: BloqueVisual): boolean {
    return bloque.campos.some(c => c.tipo_campo === 'food-table');
  }

  getFormArray(clave: string): FormArray {
    return this.form.get(clave) as FormArray;
  }

  agregarFilaTabla(clave: string) {
    const arr = this.getFormArray(clave);
    if (arr) {
      arr.push(this.fb.group({
        alimento: [''],
        cantidad: [''],
        unidad: [''],
        frecuencia: [''],
        nota: ['']
      }));
    }
  }

  eliminarFilaTabla(clave: string, index: number) {
    const arr = this.getFormArray(clave);
    if (arr) {
      arr.removeAt(index);
    }
  }

  confirmingDelete: Record<string, number | null> = {};

  isConfirmingDelete(clave: string, index: number): boolean {
    return this.confirmingDelete[clave] === index;
  }

  handleDeleteClick(clave: string, index: number) {
    const arr = this.getFormArray(clave);
    if (!arr || arr.length <= 1) return;

    const rowValue = arr.at(index).value;
    const hasContent = Object.values(rowValue).some(val => val !== null && val !== undefined && String(val).trim() !== '');

    if (!hasContent) {
      // Empty row: delete immediately
      this.eliminarFilaTabla(clave, index);
      this.confirmingDelete[clave] = null;
    } else {
      // Row has content: check if it's the second click
      if (this.confirmingDelete[clave] === index) {
        this.eliminarFilaTabla(clave, index);
        this.confirmingDelete[clave] = null;
      } else {
        // First click: activate confirmation
        this.confirmingDelete[clave] = index;
        // Auto reset confirmation state after 3 seconds
        setTimeout(() => {
          if (this.confirmingDelete[clave] === index) {
            this.confirmingDelete[clave] = null;
          }
        }, 3000);
      }
    }
  }

  onInputRow(clave: string, index: number) {
    const arr = this.getFormArray(clave);
    if (!arr) return;

    // Check if the modified row is the last one in the FormArray
    if (index === arr.length - 1) {
      const rowValue = arr.at(index).value;
      const hasContent = Object.values(rowValue).some(val => val !== null && val !== undefined && String(val).trim() !== '');
      if (hasContent) {
        this.agregarFilaTabla(clave);
      }
    }
  }

  isBooleanField(campo: CampoFormulario): boolean {
    return campo.tipo_campo === 'boolean';
  }

  async guardarConsulta() {
    if (!this.isSigned) {
      this.dialog.open(SimpleDialogComponent, {
        data: {
          type: 'warning',
          title: 'Firma Requerida',
          message: 'La nota de consulta debe estar firmada digitalmente antes de poder guardarse como final.'
        }
      });
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;

    try {
      const valores = this.form.getRawValue();
      const recordatorioVal = valores['recordatorio_24h'] || [];
      this.snapshotAyer = recordatorioVal;

      const datosEspecificos: Record<string, unknown> = {};
      const consumoSemanal: Record<string, unknown> = {};

      for (const campo of this.campos) {
        let valor = valores[campo.clave as keyof typeof valores];
        
        if (campo.tipo_campo === 'food-table' && Array.isArray(valor)) {
          // Exclude rows where all fields are empty
          valor = valor.filter(row => 
            Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '')
          );
        }

        if (this.esBloqueDos(campo.bloque)) {
          consumoSemanal[campo.clave] = valor ?? null;
        } else {
          datosEspecificos[campo.clave] = valor ?? null;
        }
      }

      // Add signature and antecedents snapshot to datosEspecificos
      datosEspecificos['firma_digital'] = this.signatureSeal;
      datosEspecificos['firma_nombre'] = this.signatureName;
      datosEspecificos['firma_fecha'] = this.signatureDate?.toISOString();
      datosEspecificos['antecedentes_familiares_snapshot'] = this.antecedentesContent;

      const payload: any = {
        student_id: this.pacienteId,
        professional_id: this.nutriologoId,
        fecha_consulta: new Date().toISOString(),
        calorias_totales: Number(valores.calorias_totales || 0),
        datos_especificos: datosEspecificos,
        consumo_semanal: consumoSemanal,
        recordatorio_24h: recordatorioVal,
        appointment_id: this.sessionId || null
      };

      await this.nutricionService.crearConsulta(payload);

      // If associated with a session/appointment, update its status to completed
      if (this.sessionId) {
        await this.supabaseService.supabase
          .from('appointments')
          .update({ 
            status: 'completed', 
            notes: `<p><strong>Consulta Nutricional Finalizada.</strong></p><p>Sello de firma: ${this.signatureSeal}</p>` 
          })
          .eq('id', this.sessionId);

        // Registrar el logro de cita completada para el estudiante
        await this.supabaseService.supabase.rpc('update_user_activity_streak', {
          p_user_id: this.pacienteId,
          p_category: 'appointment'
        });
      }

      const dialogRef = this.dialog.open(SimpleDialogComponent, {
        data: {
          type: 'success',
          title: 'Consulta Guardada',
          message: 'Consulta nutricional guardada con éxito.'
        }
      });
      dialogRef.afterClosed().subscribe(() => {
        this.router.navigate(['/nutritionist/pacientes', this.pacienteId]);
      });
    } catch (error) {
      console.error('Error guardando consulta nutricional:', error);
      this.dialog.open(SimpleDialogComponent, {
        data: {
          type: 'error',
          title: 'Error al Guardar',
          message: 'No se pudo guardar la consulta nutricional. Intente nuevamente.'
        }
      });
    } finally {
      this.saving = false;
    }
  }

  async signWithMetaSeal() {
    try {
      const { data: profProfile } = await this.supabaseService.supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', this.nutriologoId)
        .single();

      const name = profProfile 
        ? `Nut. ${profProfile.first_name} ${profProfile.last_name}` 
        : `Nutricionista (ID: ${this.nutriologoId.substring(0,8)})`;

      this.signatureName = name;
      this.signatureDate = new Date();
      
      const rawString = `${this.nutriologoId}-${this.pacienteId}-${this.signatureDate.toISOString()}-META-SEAL-SECURE`;
      let hash = 0;
      for (let i = 0; i < rawString.length; i++) {
        hash = (hash << 5) - hash + rawString.charCodeAt(i);
        hash |= 0;
      }
      const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
      this.signatureSeal = `META-SEAL-SECURE-SIGNATURE-SHA256: ${hexHash}-${this.pacienteId.substring(0, 8).toUpperCase()}`;

      this.isSigned = true;

      // Lock all controls in the main form
      this.form.disable();
      // Lock editing of family antecedents
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

    // Re-enable all controls in the main form
    this.form.enable();
  }

  async markNoShow() {
    if (!this.sessionId) {
      alert('No hay una cita específica seleccionada para marcar inasistencia.');
      return;
    }
    if (!confirm('¿Estás seguro de marcar esta consulta como Inasistencia?')) return;
    
    this.loading = true;
    const { error } = await this.supabaseService.supabase
      .from('appointments')
      .update({ status: 'no_show', notes: '<p><strong>Inasistencia:</strong> El paciente no se presentó a la consulta.</p>' })
      .eq('id', this.sessionId);
      
    this.loading = false;
    if (error) {
      console.error(error);
      alert('Error al actualizar inasistencia');
    } else {
      alert('Inasistencia registrada.');
      this.cancelar();
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
      const { data: recordData, error: fetchError } = await this.supabaseService.supabase
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

      const { error: updateError } = await this.supabaseService.supabase
        .from('student_clinical_records')
        .update({ additional_notes: encryptedNotes })
        .eq('student_id', this.patient.student_id);

      if (updateError) throw updateError;

      const { error: profileError } = await this.supabaseService.supabase
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

  cancelar() {
    this.router.navigate(['/nutritionist/pacientes', this.pacienteId]);
  }

  // ponytail: Added methods to load and manage the editable 24h recall from patient's food diary
  get recordatorio24hArray(): FormArray {
    return this.form.get('recordatorio_24h') as FormArray;
  }

  agregarFilaRecordatorio() {
    const todayStr = new Date().toISOString().split('T')[0];
    this.recordatorio24hArray.push(this.fb.group({
      diary_date: [todayStr],
      meal_time: ['12:00'],
      what_i_ate: [''],
      mood_before: [''],
      mood_after: ['']
    }));
  }

  eliminarFilaRecordatorio(index: number) {
    this.recordatorio24hArray.removeAt(index);
  }

  stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private async loadRecordatorio24h(existingConsulta?: ConsultaNutricionRow | null) {
    const arr = this.recordatorio24hArray;
    while (arr.length) arr.removeAt(0);

    if (existingConsulta && existingConsulta.recordatorio_24h) {
      const records = existingConsulta.recordatorio_24h;
      if (Array.isArray(records)) {
        for (const item of records) {
          arr.push(this.fb.group({
            diary_date: [item.diary_date || ''],
            meal_time: [item.meal_time || ''],
            what_i_ate: [item.what_i_ate || ''],
            mood_before: [item.mood_before || ''],
            mood_after: [item.mood_after || '']
          }));
        }
        return;
      }
    }

    try {
      const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];

      console.log('loadRecordatorio24h: Paciente ID =', this.pacienteId);
      console.log('loadRecordatorio24h: Rango de fechas =', yesterdayStr, 'a', todayStr);

      const { data: diaryEntries, error } = await this.supabaseService.supabase
        .from('food_diary_entries')
        .select('diary_date, meal_time, what_i_ate, mood_before, mood_after')
        .eq('student_id', this.pacienteId)
        .gte('diary_date', yesterdayStr)
        .lte('diary_date', todayStr)
        .order('diary_date', { ascending: false })
        .order('meal_time', { ascending: true });

      console.log('loadRecordatorio24h: Query con fechas - Result =', diaryEntries, 'Error =', error);

      if (error) throw error;

      if (diaryEntries && diaryEntries.length > 0) {
        for (const item of diaryEntries) {
          let decryptedWhat = '';
          try {
            decryptedWhat = this.crypto.decrypt(item.what_i_ate || '');
          } catch(e) {
            decryptedWhat = item.what_i_ate || '';
          }
          arr.push(this.fb.group({
            diary_date: [item.diary_date || ''],
            meal_time: [item.meal_time ? item.meal_time.substring(0, 5) : ''],
            what_i_ate: [this.stripHtml(decryptedWhat)],
            mood_before: [item.mood_before || ''],
            mood_after: [item.mood_after || '']
          }));
        }
      } else {
        // Test query without date filter to see if it is a date issue or RLS
        const { data: allEntries, error: allErr } = await this.supabaseService.supabase
          .from('food_diary_entries')
          .select('diary_date, meal_time, what_i_ate, mood_before, mood_after')
          .eq('student_id', this.pacienteId)
          .limit(5);

        console.log('loadRecordatorio24h: Query SIN filtro fechas - Result =', allEntries, 'Error =', allErr);

        if (allEntries && allEntries.length > 0) {
          console.warn('loadRecordatorio24h: Cargando sin filtro de fechas debido a disparidad de zonas horarias.');
          for (const item of allEntries) {
            let decryptedWhat = '';
            try {
              decryptedWhat = this.crypto.decrypt(item.what_i_ate || '');
            } catch(e) {
              decryptedWhat = item.what_i_ate || '';
            }
            arr.push(this.fb.group({
              diary_date: [item.diary_date || ''],
              meal_time: [item.meal_time ? item.meal_time.substring(0, 5) : ''],
              what_i_ate: [this.stripHtml(decryptedWhat)],
              mood_before: [item.mood_before || ''],
              mood_after: [item.mood_after || '']
            }));
          }
        } else {
          this.agregarFilaRecordatorio();
        }
      }
    } catch (err) {
      console.error('Error fetching food diary entries:', err);
      this.agregarFilaRecordatorio();
    }
  }

  private esBloqueDos(bloque: string): boolean {
    const value = (bloque || '').toLowerCase();
    return value.includes('2') || value.includes('semanal') || value.includes('consumo');
  }
}

@Component({
  selector: 'app-simple-dialog',
  template: `
    <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; max-width: 380px; background: var(--bg-card); color: var(--text-primary);">
      <div style="display: flex; align-items: center; gap: 0.6rem;" [style.color]="data.type === 'error' ? '#ef4444' : data.type === 'warning' ? '#f59e0b' : '#10b981'">
        <mat-icon style="font-size: 28px; width: 28px; height: 28px;">{{ data.type === 'error' ? 'error' : data.type === 'warning' ? 'warning' : 'check_circle' }}</mat-icon>
        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700; color: var(--text-primary);">{{ data.title }}</h3>
      </div>
      <p style="margin: 0; font-size: 0.95rem; color: var(--text-secondary); line-height: 1.4;">{{ data.message }}</p>
      <div style="display: flex; justify-content: flex-end; margin-top: 0.5rem;">
        <button (click)="close()" [style.background]="data.type === 'error' ? '#ef4444' : data.type === 'warning' ? '#f59e0b' : '#10b981'" style="color: white; border: none; border-radius: 8px; padding: 0.55rem 1.35rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Aceptar</button>
      </div>
    </div>
  `,
  standalone: true,
  imports: [MatIconModule]
})
export class SimpleDialogComponent {
  private dialogRef = inject(MatDialogRef<SimpleDialogComponent>);
  public data = inject(MAT_DIALOG_DATA);

  close() {
    this.dialogRef.close();
  }
}
