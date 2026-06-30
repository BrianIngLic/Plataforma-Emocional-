import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-institutional-settings',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  templateUrl: './institutional-settings.component.html',
  styleUrls: ['./institutional-settings.component.scss']
})
export class InstitutionalSettingsComponent implements OnInit {
  supabase = inject(SupabaseService).supabase;

  isDragging = false;
  isUploading = false;
  isSavingName = false;
  uploadProgress = 0;
  errorMessage = '';
  successMessage = '';

  institutionName: string = 'BENEMÉRITA UNIVERSIDAD AUTÓNOMA DE PUEBLA';
  currentWatermarkUrl: string | null = null;
  watermarkOpacity: number = 12; // 12% por defecto en la especificación
  watermarkScale: number = 80;

  async ngOnInit() {
    await this.loadInstitutionSettings();
    await this.loadInstitutionalWatermark();
  }

  async loadInstitutionSettings() {
    try {
      const { data, error } = await this.supabase
        .from('institutional_settings')
        .select('institution_name')
        .eq('id', 1)
        .single();
      
      if (data && data.institution_name) {
        this.institutionName = data.institution_name;
      }
    } catch (err) {
      console.warn('Tabla institutional_settings aún no inicializada o sin registros:', err);
    }
  }

  async saveInstitutionName() {
    if (!this.institutionName.trim()) return;
    this.isSavingName = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const { error } = await this.supabase
        .from('institutional_settings')
        .upsert({ id: 1, institution_name: this.institutionName, updated_at: new Date().toISOString() });

      if (error) throw error;
      this.successMessage = '¡Nombre de la institución actualizado exitosamente!';
    } catch (err: any) {
      console.error('Error guardando nombre de institución:', err);
      this.errorMessage = 'Error al guardar el nombre: ' + (err.message || err);
    } finally {
      this.isSavingName = false;
    }
  }

  async loadInstitutionalWatermark() {
    try {
      // Verificar si el archivo existe listando el bucket para evitar error 400 en consola
      const { data: listData, error: listError } = await this.supabase.storage.from('institutional_assets').list();
      if (listError) {
        console.warn('Bucket institutional_assets no disponible o vacío:', listError);
        return;
      }

      const hasWatermark = listData?.some((file: any) => file.name === 'watermark_logo.png');
      if (hasWatermark) {
        const { data } = await this.supabase.storage.from('institutional_assets').getPublicUrl('watermark_logo.png');
        if (data && data.publicUrl) {
          this.currentWatermarkUrl = data.publicUrl + '?ts=' + new Date().getTime();
        }
      }
    } catch (err) {
      console.error('Error cargando marca de agua:', err);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  async onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      await this.handleFileUpload(files[0]);
    }
  }

  async onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      await this.handleFileUpload(file);
    }
  }

  async handleFileUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Por favor selecciona un archivo de imagen válido (PNG, JPG, SVG).';
      return;
    }

    this.isUploading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      // Subir con nombre fijo watermark_logo.png al bucket institutional_assets
      const { data, error } = await this.supabase.storage
        .from('institutional_assets')
        .upload('watermark_logo.png', file, {
          cacheControl: '0', // Evitar almacenamiento en caché del servidor
          upsert: true
        });
 
      if (error) {
        if (error.message?.includes('Bucket not found')) {
          throw new Error('El bucket "institutional_assets" no existe en Supabase. Por favor, créalo en el Dashboard de Supabase -> Storage -> New Bucket (Nombre: institutional_assets, Público: activado).');
        }
        throw error;
      }

      this.successMessage = '¡Marca de agua institucional cargada y configurada exitosamente!';
      await this.loadInstitutionalWatermark();
    } catch (err: any) {
      console.error('Error subiendo marca de agua:', err);
      this.errorMessage = err.message || err;
    } finally {
      this.isUploading = false;
    }
  }

  async removeWatermark() {
    if (!confirm('¿Estás seguro de eliminar la marca de agua institucional?')) return;

    try {
      const { error } = await this.supabase.storage.from('institutional_assets').remove(['watermark_logo.png']);
      if (error) throw error;
      this.currentWatermarkUrl = null;
      this.successMessage = 'Marca de agua eliminada exitosamente.';
    } catch (err: any) {
      console.error('Error eliminando:', err);
      this.errorMessage = 'Error al eliminar la marca de agua: ' + (err.message || err);
    }
  }
}
