import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';

export type CampoFormularioTipo = 'text' | 'number' | 'boolean' | 'select';

export interface CampoFormulario {
  id: string;
  bloque: string;
  clave: string;
  etiqueta: string;
  tipo_campo: CampoFormularioTipo;
  activo: boolean;
}

export interface ConsultaNutricionRow {
  id: string;
  student_id: string;
  professional_id: string;
  fecha_consulta: string;
  calorias_totales: number;
  datos_especificos: Record<string, unknown>;
  consumo_semanal: Record<string, unknown>;
  recordatorio_24h: Record<string, unknown>;
}

export interface NuevaConsultaNutricionPayload {
  student_id: string;
  professional_id: string;
  fecha_consulta: string;
  calorias_totales: number;
  datos_especificos: Record<string, unknown>;
  consumo_semanal: Record<string, unknown>;
  recordatorio_24h: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class NutricionService {
  private supabase = inject(SupabaseService).supabase;

  async obtenerCamposFormulario(): Promise<CampoFormulario[]> {
    const { data, error } = await this.supabase
      .from('campos_formulario')
      .select('id, bloque, clave, etiqueta, tipo_campo, activo')
      .eq('activo', true)
      .order('bloque', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as CampoFormulario[];
  }

  async obtenerUltimaConsulta(pacienteId: string): Promise<ConsultaNutricionRow | null> {
    const { data, error } = await this.supabase
      .from('consultas_nutricion')
      .select('id, student_id, professional_id, fecha_consulta, calorias_totales, datos_especificos, consumo_semanal, recordatorio_24h')
      .eq('student_id', pacienteId)
      .order('fecha_consulta', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }

    return (data as ConsultaNutricionRow) || null;
  }

  async crearConsulta(payload: NuevaConsultaNutricionPayload): Promise<ConsultaNutricionRow> {
    const { data, error } = await this.supabase
      .from('consultas_nutricion')
      .insert(payload)
      .select('id, student_id, professional_id, fecha_consulta, calorias_totales, datos_especificos, consumo_semanal, recordatorio_24h')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as ConsultaNutricionRow;
  }

  agruparCamposPorBloque(campos: CampoFormulario[]) {
    const bloque1 = campos.filter(campo => this.esBloqueDos(campo.bloque) === false);
    const bloque2 = campos.filter(campo => this.esBloqueDos(campo.bloque) === true);
    return { bloque1, bloque2 };
  }

  private esBloqueDos(bloque: string): boolean {
    const value = (bloque || '').toLowerCase();
    return value.includes('2') || value.includes('semanal') || value.includes('consumo');
  }
}
