import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';

/**
 * Servicio encargado de la gestión del expediente clínico del estudiante.
 */
@Injectable({
  providedIn: 'root'
})
export class ClinicalService {

  constructor() {}

  /**
   * Envía el formulario clínico inicial hacia PostgREST.
   * Utiliza RxJS para simular la llamada asíncrona de red (Mock temporal).
   * 
   * @param matricula Matrícula del estudiante
   * @param conditions Array de condiciones clínicas seleccionadas
   * @param consent Booleano de consentimiento
   * @returns Observable con el resultado de la operación
   */
  submitClinicalRecords(matricula: string, conditions: string[], consent: boolean): Observable<boolean> {
    console.log(`[ClinicalService] Procesando expediente para ${matricula}:`, conditions);
    
    // Simula un retardo de red de 1 segundo para probar UI de "Cargando..."
    return of(true).pipe(delay(1000));
  }
}
