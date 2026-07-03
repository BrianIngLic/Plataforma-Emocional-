import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NutricionService, CampoFormulario, ConsultaNutricionRow, NuevaConsultaNutricionPayload } from '../../../core/services/nutrition/nutricion.service';
import { CalendarioService, RegistroAyerSnapshot } from '../../../core/services/nutrition/calendario.service';
import { AuthService } from '../../../core/services/auth.service';

interface BloqueVisual {
  titulo: string;
  campos: CampoFormulario[];
}

@Component({
  selector: 'app-consulta-nutricion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MatIconModule],
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

  form: FormGroup<any> = this.fb.group({
    calorias_totales: new FormControl<number | null>(0, { nonNullable: false, validators: [Validators.min(0)] })
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

  get currentUserId() {
    return this.authService.currentUser()?.id || '';
  }

  async ngOnInit() {
    this.pacienteId = this.route.snapshot.paramMap.get('id') || '';
    this.nutriologoId = this.currentUserId;

    if (!this.pacienteId || !this.nutriologoId) {
      this.router.navigate(['/nutritionist/pacientes']);
      return;
    }

    await this.loadFormDefinition();
  }

  private async loadFormDefinition() {
    this.loading = true;

    try {
      this.campos = await this.nutricionService.obtenerCamposFormulario();
      this.buildDynamicForm(this.campos);

      this.ultimaConsulta = await this.nutricionService.obtenerUltimaConsulta(this.pacienteId);
      if (this.ultimaConsulta) {
        this.patchFromLastConsultation(this.ultimaConsulta);
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

      const initialValue = campo.tipo_campo === 'boolean' ? false : '';
      this.form.addControl(campo.clave, new FormControl(initialValue, { nonNullable: false }));
    }
  }

  private patchFromLastConsultation(consulta: ConsultaNutricionRow) {
    const patchValues: Record<string, unknown> = {
      calorias_totales: consulta.calorias_totales ?? 0
    };

    Object.assign(patchValues, consulta.datos_especificos || {});
    Object.assign(patchValues, consulta.consumo_semanal || {});

    this.form.patchValue(patchValues);
  }

  getCamposPorBloque(bloque: BloqueVisual): CampoFormulario[] {
    return bloque.campos;
  }

  isBooleanField(campo: CampoFormulario): boolean {
    return campo.tipo_campo === 'boolean';
  }

  async guardarConsulta() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;

    try {
      const registroAyer = await this.calendarioService.obtenerRegistroAyer(this.pacienteId);
      this.snapshotAyer = registroAyer;

      const valores = this.form.getRawValue();
      const datosEspecificos: Record<string, unknown> = {};
      const consumoSemanal: Record<string, unknown> = {};

      for (const campo of this.campos) {
        const valor = valores[campo.clave as keyof typeof valores];
        if (this.esBloqueDos(campo.bloque)) {
          consumoSemanal[campo.clave] = valor ?? null;
        } else {
          datosEspecificos[campo.clave] = valor ?? null;
        }
      }

      const payload: NuevaConsultaNutricionPayload = {
        student_id: this.pacienteId,
        professional_id: this.nutriologoId,
        fecha_consulta: new Date().toISOString(),
        calorias_totales: Number(valores.calorias_totales || 0),
        datos_especificos: datosEspecificos,
        consumo_semanal: consumoSemanal,
        recordatorio_24h: registroAyer
      };

      await this.nutricionService.crearConsulta(payload);
      alert('Consulta nutricional guardada con éxito.');
      this.router.navigate(['/nutritionist/pacientes', this.pacienteId]);
    } catch (error) {
      console.error('Error guardando consulta nutricional:', error);
      alert('No se pudo guardar la consulta.');
    } finally {
      this.saving = false;
    }
  }

  cancelar() {
    this.router.navigate(['/nutritionist/pacientes', this.pacienteId]);
  }

  private esBloqueDos(bloque: string): boolean {
    const value = (bloque || '').toLowerCase();
    return value.includes('2') || value.includes('semanal') || value.includes('consumo');
  }
}
