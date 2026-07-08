import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, FormControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SupabaseService } from '../../../core/services/supabase.service';

interface CampoFormulario {
  id?: string;
  bloque: string;
  clave: string;
  etiqueta: string;
  tipo_campo: 'text' | 'number' | 'boolean' | 'select' | 'rich-text' | 'food-table';
  orden: number;
  ayuda?: string;
  activo: boolean;
}

@Component({
  selector: 'app-nutritionist-fields',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule],
  templateUrl: './nutritionist-fields.component.html',
  styleUrls: ['./nutritionist-fields.component.scss']
})
export class NutritionistFieldsComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private fb = inject(FormBuilder);

  campos: CampoFormulario[] = [];
  loading = true;
  saving = false;
  showAddModal = false;
  selectedCampo: CampoFormulario | null = null;

  newField: Record<string, { clave: string; etiqueta: string; tipo_campo: 'text' | 'number' | 'boolean' | 'select' | 'rich-text' | 'food-table'; activo: boolean }> = {};
  savingInline: Record<string, boolean> = {};

  fieldForm: FormGroup = this.fb.group({
    bloque: ['Datos específicos', [Validators.required]],
    clave: ['', [Validators.required, Validators.pattern(/^[a-z0-9_]+$/)]],
    etiqueta: ['', [Validators.required]],
    tipo_campo: ['text', [Validators.required]],
    orden: [10, [Validators.required, Validators.min(0)]],
    ayuda: [''],
    activo: [true]
  });

  bloques = ['Datos específicos', 'Consumo semanal'];
  tipos = [
    { value: 'text', label: 'Texto simple' },
    { value: 'number', label: 'Valor numérico' },
    { value: 'boolean', label: 'Verdadero/Falso (Check)' },
    { value: 'select', label: 'Menú desplegable (Select)' },
    { value: 'rich-text', label: 'Texto enriquecido (Quill)' },
    { value: 'food-table', label: 'Tabla de alimentos (Frecuencia)' }
  ];

  ngOnInit() {
    this.resetInlineFields();
    this.loadFields();
  }

  resetInlineFields() {
    this.bloques.forEach(b => {
      this.newField[b] = {
        clave: '',
        etiqueta: '',
        tipo_campo: 'text',
        activo: true
      };
      this.savingInline[b] = false;
    });
  }

  getTipoLabel(tipo: string): string {
    const found = this.tipos.find(t => t.value === tipo);
    return found ? found.label : tipo;
  }

  async addInlineField(bloque: string) {
    const field = this.newField[bloque];
    if (!field.clave || !field.etiqueta) {
      alert('Por favor complete la clave y la etiqueta.');
      return;
    }

    const pattern = /^[a-z0-9_]+$/;
    if (!pattern.test(field.clave)) {
      alert('La clave solo debe contener minúsculas, números y guiones bajos.');
      return;
    }

    if (this.campos.some(c => c.clave === field.clave)) {
      alert('La clave ya existe. Por favor use una clave única.');
      return;
    }

    this.savingInline[bloque] = true;
    try {
      const nextOrden = this.getNextOrden(bloque);
      const { error } = await this.supabaseService.supabase
        .from('campos_formulario')
        .insert({
          bloque,
          clave: field.clave,
          etiqueta: field.etiqueta,
          tipo_campo: field.tipo_campo,
          orden: nextOrden,
          activo: field.activo
        });

      if (error) throw error;
      
      await this.loadFields();
      this.newField[bloque] = {
        clave: '',
        etiqueta: '',
        tipo_campo: 'text',
        activo: true
      };
      alert('Campo agregado con éxito.');
    } catch (err) {
      console.error('Error adding inline field:', err);
      alert('Error al agregar campo.');
    } finally {
      this.savingInline[bloque] = false;
    }
  }

  async loadFields() {
    this.loading = true;
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('campos_formulario')
        .select('*')
        .order('bloque', { ascending: true })
        .order('orden', { ascending: true });

      if (error) throw error;
      this.campos = data || [];
    } catch (err) {
      console.error('Error loading fields:', err);
      alert('Error al cargar catálogo de campos.');
    } finally {
      this.loading = false;
    }
  }

  openAddModal() {
    this.selectedCampo = null;
    this.fieldForm.reset({
      bloque: 'Datos específicos',
      clave: '',
      etiqueta: '',
      tipo_campo: 'text',
      orden: this.getNextOrden('Datos específicos'),
      ayuda: '',
      activo: true
    });
    this.fieldForm.get('clave')?.enable();
    this.showAddModal = true;
  }

  openEditModal(campo: CampoFormulario) {
    this.selectedCampo = campo;
    this.fieldForm.reset({
      bloque: campo.bloque,
      clave: campo.clave,
      etiqueta: campo.etiqueta,
      tipo_campo: campo.tipo_campo,
      orden: campo.orden,
      ayuda: campo.ayuda || '',
      activo: campo.activo
    });
    this.fieldForm.get('clave')?.disable(); // Clave cannot be edited
    this.showAddModal = true;
  }

  closeModal() {
    this.showAddModal = false;
    this.selectedCampo = null;
  }

  async saveField() {
    if (this.fieldForm.invalid) {
      this.fieldForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const values = this.fieldForm.getRawValue();

    try {
      if (this.selectedCampo) {
        // Update existing field
        const { error } = await this.supabaseService.supabase
          .from('campos_formulario')
          .update({
            bloque: values.bloque,
            etiqueta: values.etiqueta,
            tipo_campo: values.tipo_campo,
            orden: values.orden,
            ayuda: values.ayuda,
            activo: values.activo
          })
          .eq('clave', this.selectedCampo.clave);

        if (error) throw error;
      } else {
        // Insert new field
        const { error } = await this.supabaseService.supabase
          .from('campos_formulario')
          .insert({
            bloque: values.bloque,
            clave: values.clave,
            etiqueta: values.etiqueta,
            tipo_campo: values.tipo_campo,
            orden: values.orden,
            ayuda: values.ayuda,
            activo: values.activo
          });

        if (error) throw error;
      }

      await this.loadFields();
      this.closeModal();
      alert('Campo guardado con éxito.');
    } catch (err) {
      console.error('Error saving field:', err);
      alert('Ocurrió un error al guardar el campo.');
    } finally {
      this.saving = false;
    }
  }

  async deleteField(campo: CampoFormulario) {
    if (!confirm(`¿Estás seguro de eliminar el campo "${campo.etiqueta}"? Esta acción no se puede deshacer y puede afectar consultas guardadas.`)) return;

    try {
      const { error } = await this.supabaseService.supabase
        .from('campos_formulario')
        .delete()
        .eq('clave', campo.clave);

      if (error) throw error;
      await this.loadFields();
      alert('Campo eliminado con éxito.');
    } catch (err) {
      console.error('Error deleting field:', err);
      alert('Error al eliminar campo.');
    }
  }

  async toggleActivo(campo: CampoFormulario) {
    try {
      const { error } = await this.supabaseService.supabase
        .from('campos_formulario')
        .update({ activo: !campo.activo })
        .eq('clave', campo.clave);

      if (error) throw error;
      campo.activo = !campo.activo;
    } catch (err) {
      console.error('Error toggling activo:', err);
      alert('Error al cambiar estado.');
    }
  }

  async moveOrder(campo: CampoFormulario, direction: 'up' | 'down') {
    const fieldsInBloque = this.getCamposPorBloqueName(campo.bloque);
    const index = fieldsInBloque.findIndex(c => c.clave === campo.clave);
    
    if (direction === 'up' && index > 0) {
      const prev = fieldsInBloque[index - 1];
      const tempOrder = campo.orden;
      campo.orden = prev.orden;
      prev.orden = tempOrder;
      
      await this.updateFieldOrder(campo);
      await this.updateFieldOrder(prev);
    } else if (direction === 'down' && index < fieldsInBloque.length - 1) {
      const next = fieldsInBloque[index + 1];
      const tempOrder = campo.orden;
      campo.orden = next.orden;
      next.orden = tempOrder;
      
      await this.updateFieldOrder(campo);
      await this.updateFieldOrder(next);
    }
    
    await this.loadFields();
  }

  private async updateFieldOrder(campo: CampoFormulario) {
    await this.supabaseService.supabase
      .from('campos_formulario')
      .update({ orden: campo.orden })
      .eq('clave', campo.clave);
  }

  private getNextOrden(bloque: string): number {
    const fieldsInBloque = this.getCamposPorBloqueName(bloque);
    if (fieldsInBloque.length === 0) return 10;
    return Math.max(...fieldsInBloque.map(c => c.orden)) + 10;
  }

  getCamposPorBloqueName(bloque: string): CampoFormulario[] {
    return this.campos.filter(c => c.bloque.toLowerCase() === bloque.toLowerCase());
  }
}
