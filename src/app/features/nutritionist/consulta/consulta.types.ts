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
  paciente_id: string;
  nutriologo_id: string;
  fecha_consulta: string;
  calorias_totales: number;
  datos_especificos: Record<string, unknown>;
  consumo_semanal: Record<string, unknown>;
  recordatorio_24h: Record<string, unknown>;
}
