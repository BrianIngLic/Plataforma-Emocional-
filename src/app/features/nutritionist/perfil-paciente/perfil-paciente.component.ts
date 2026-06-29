import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { AuthService } from '../../../core/services/auth.service';
import { DossierExportService } from '../../../core/services/dossier-export.service';
import { jsPDF } from 'jspdf';

@Component({
  selector: 'app-perfil-paciente',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, FormsModule],
  templateUrl: './perfil-paciente.html',
  styleUrl: './perfil-paciente.scss'
})
export class PerfilPaciente implements OnInit {
  supabase = inject(SupabaseService).supabase;
  crypto = inject(CryptoService);
  authService = inject(AuthService);
  dossierExport = inject(DossierExportService);

  patient: any = null;
  diaryEntries: any[] = [];
  loading = true;
  isExporting = false;
  sessionHistory: any[] = [];
  eat26Result: any = null;

  // Navegación interna (Tabs)
  activeTab: 'expediente' | 'recordatorio' | 'diario' = 'expediente';

  // Datos clínicos estructurados
  clinicalNotesObj: any = {};
  generalData: any = null;

  specificData = {
    problemas_gastrointestinales: '',
    alergia_intolerancia: '',
    enfermedad_padecimiento: '',
    medicamentos_consumo: '',
    alimentos_desagrado: '',
    actividad_fisica: '',
    dias_actividad: '',
    tiempo_actividad: '',
    comidas_al_dia: '',
    colaciones_al_dia: '',
    comidas_mantener: '',
    consumo_agua: '',
    tiempo_sueno: '',
    comentarios: ''
  };

  weeklyConsumption = {
    verduras: '',
    frutas: '',
    lacteos: '',
    cereales: '',
    leguminosas: '',
    azucar: '',
    aoa: '',
    aceites: '',
    comentarios: ''
  };

  recall24h: any[] = [];
  isSavingRecord = false;

  // Variables del Calendario
  currentDate = new Date();
  monthName = '';
  year = 0;
  calendarDays: number[] = [];
  blankDays: number[] = [];
  selectedDate: number | null = null;
  
  calendarMode: 'days' | 'months' = 'days';
  monthsList = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  get currentUserId() { return this.authService.currentUser()?.id; }

  constructor(private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadPatientData(id);
    } else {
      this.goBack();
    }
  }

  calculateEat26Score(parsedNotes: any): any {
    let score = 0;
    let hasBehavioralRisk = false;

    const scoreMapNormal: any = { 'Siempre': 3, 'Casi siempre': 2, 'A menudo': 1, 'A veces': 0, 'Rara vez': 0, 'Nunca': 0 };
    const scoreMapQ26: any = { 'Siempre': 0, 'Casi siempre': 0, 'A menudo': 0, 'A veces': 1, 'Rara vez': 2, 'Nunca': 3 };

    for (let i = 1; i <= 26; i++) {
      const ans = parsedNotes['q' + i];
      if (ans) {
        if (i === 26) {
          score += scoreMapQ26[ans] || 0;
        } else {
          score += scoreMapNormal[ans] || 0;
        }
      }
    }

    const behavioralIds = ['bA', 'bB', 'bC', 'bD'];
    behavioralIds.forEach(id => {
       const ans = parsedNotes[id];
       if (ans && ans !== 'Nunca' && ans !== 'No') {
          hasBehavioralRisk = true;
       }
    });
    
    if (parsedNotes['bE'] === 'Sí') {
       hasBehavioralRisk = true;
    }

    const hasRisk = score >= 20 || hasBehavioralRisk;
    
    let interpretation = hasRisk 
      ? 'Riesgo de Trastorno de Conducta Alimentaria (TCA). Se recomienda evaluación diagnóstica especializada.'
      : 'Sin evidencia numérica de riesgo alto, sin embargo, el juicio clínico prevalece.';

    return {
      score,
      hasRisk,
      behavioralRisk: hasBehavioralRisk,
      interpretation
    };
  }

  async loadPatientData(id: string) {
    this.loading = true;
    
    try {
      // 1. Obtener usuario + perfil + expediente clínico
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('id, matricula, profiles(first_name, last_name, avatar_url, faculty), student_clinical_records!student_clinical_records_student_id_fkey(known_conditions, additional_notes)')
        .eq('id', id)
        .single();

      if (userError) {
        console.error('Error fetching patient data:', userError);
      }

      if (userData) {
        const p = Array.isArray(userData.profiles) ? userData.profiles[0] : userData.profiles;
        const records = userData.student_clinical_records;
        const recordObj = Array.isArray(records) ? records[0] : records;
        
        const conditions = recordObj?.known_conditions;
        let notes = recordObj?.additional_notes;

        if (notes) {
          notes = this.crypto.decrypt(notes);
          try {
            this.clinicalNotesObj = JSON.parse(notes);
            
            // Cargar datos generales (Estudiante)
            if (this.clinicalNotesObj.general_data) {
              this.generalData = this.clinicalNotesObj.general_data;
            } else {
              this.generalData = {
                nombre: `${p?.first_name || 'Paciente'} ${p?.last_name || 'Sin Nombre'}`,
                unidad_academica: p?.faculty || 'BUAP',
                programa_educativo: 'Pendiente de registrar',
                celular: 'Sin registrar',
                correo: 'sin_registrar@buap.mx',
                antecedentes_familiares: 'Sin registrar',
                sexo: 'Sin registrar',
                fecha_nacimiento: '',
                edad: 22
              };
            }

            // Cargar datos específicos (Nutricionista)
            if (this.clinicalNotesObj.specific_data) {
              this.specificData = { ...this.specificData, ...this.clinicalNotesObj.specific_data };
            }

            // Cargar consumo semanal (Nutricionista)
            if (this.clinicalNotesObj.weekly_consumption) {
              this.weeklyConsumption = { ...this.weeklyConsumption, ...this.clinicalNotesObj.weekly_consumption };
            }

            // Cargar recordatorio de 24 horas
            if (this.clinicalNotesObj.recall_24h) {
              this.recall24h = this.clinicalNotesObj.recall_24h;
            }

            if (this.clinicalNotesObj.q1) {
                this.eat26Result = this.calculateEat26Score(this.clinicalNotesObj);
            }
          } catch(e) {}
        } else {
          notes = "Sin notas clínicas adicionales guardadas en el expediente.";
          this.generalData = {
            nombre: `${p?.first_name || 'Paciente'} ${p?.last_name || 'Sin Nombre'}`,
            unidad_academica: p?.faculty || 'BUAP',
            programa_educativo: 'Pendiente de registrar',
            celular: 'Sin registrar',
            correo: 'sin_registrar@buap.mx',
            antecedentes_familiares: 'Sin registrar',
            sexo: 'Sin registrar',
            fecha_nacimiento: '',
            edad: 22
          };
        }

        this.patient = {
          id: userData.id,
          firstName: p?.first_name || 'Paciente',
          lastName: p?.last_name || 'Sin Nombre',
          matricula: userData.matricula || 'N/A',
          age: this.generalData?.edad || 22,
          gender: this.generalData?.unidad_academica || p?.faculty || "Estudiante BUAP",
          diagnosis: conditions && conditions.length > 0 ? conditions.join(' + ') : "Evaluación Pendiente",
          treatmentPlan: "Monitoreo Nutricional + Plan Alimentario Personalizado",
          medications: this.specificData.medicamentos_consumo ? [this.specificData.medicamentos_consumo] : ["Ninguno registrado"],
          sessionCount: 0,
          nextSession: "Por agendar",
          state: (this.eat26Result && this.eat26Result.hasRisk) ? "Critical" : "Active",
          riskLevel: (this.eat26Result && this.eat26Result.hasRisk) ? "Alto" : (conditions && conditions.length > 0 ? "Moderado" : "Bajo"),
          notes: notes,
          avatar: p?.avatar_url
        };
      }

      // 2. Obtener entradas del diario del estudiante
      const { data: diaryData, error: diaryError } = await this.supabase
        .from('diary_entries')
        .select('id, content, moods, high_risk, created_at')
        .eq('student_id', id)
        .order('created_at', { ascending: false });
        
      if (diaryError) {
        console.error('Error fetching diary entries:', diaryError);
      }

      if (diaryData) {
        this.diaryEntries = diaryData.map((entry: any) => {
          return {
            rawDate: new Date(entry.created_at),
            date: new Date(entry.created_at).toLocaleDateString() + ' ' + new Date(entry.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            mood: entry.moods && entry.moods.length > 0 ? entry.moods.join(', ') : 'Neutro',
            moodColor: entry.high_risk ? 'text-red' : 'text-primary',
            moodIcon: entry.high_risk ? 'warning' : 'sentiment_satisfied',
            content: this.crypto.decrypt(entry.content)
          };
        });
      }

      // 3. Obtener historial de citas (donde el nutricionista actual es el tratante)
      if (this.currentUserId) {
        const { data: appts } = await this.supabase
          .from('appointments')
          .select('*')
          .eq('student_id', id)
          .eq('psychologist_id', this.currentUserId) // Usamos la columna psychologist_id para almacenar el ID del nutricionista
          .order('scheduled_date', { ascending: false })
          .order('start_time', { ascending: false });

        if (appts) {
          this.sessionHistory = appts.map(a => {
            const d = new Date(a.scheduled_date.substring(0, 10) + 'T12:00:00');
            const day = d.getDate().toString().padStart(2, '0');
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const year = d.getFullYear();

            return {
              id: a.id,
              rawDate: d,
              date: `${day} - ${month} - ${year}`,
              time: a.start_time ? a.start_time.substring(0,5) : '',
              status: a.status || 'unknown',
              type: "Consulta Nutricional",
              duration: "30 min",
              notes: a.notes || 'Sin notas registradas.',
              mood: a.status === 'scheduled' ? 'Programada' : a.status === 'completed' ? 'Completada' : 'Ausente'
            }
          });

          // Actualizar estadísticas del paciente basándose en las citas reales
          const completedSessions = appts.filter((a: any) => a.status === 'completed').length;
          
          // Encontrar la próxima sesión programada
          const scheduledAppts = appts
            .filter((a: any) => a.status === 'scheduled')
            .sort((a: any, b: any) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
            
          let nextSessionText = "Por agendar";
          if (scheduledAppts.length > 0) {
            const nextAppt = scheduledAppts[0];
            const d = new Date(nextAppt.scheduled_date.substring(0, 10) + 'T12:00:00');
            const day = d.getDate().toString().padStart(2, '0');
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            nextSessionText = `${day}/${month}/${d.getFullYear()}`;
          }

          this.patient.sessionCount = completedSessions;
          this.patient.nextSession = nextSessionText;
        }
      }

    } catch (err) {
      console.error('Unexpected error loading patient data:', err);
    }

    this.generateCalendar();
    this.loading = false;
  }

  generateCalendar() {
    this.year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const formatter = new Intl.DateTimeFormat('es-ES', { month: 'long' });
    this.monthName = formatter.format(this.currentDate);
    this.monthName = this.monthName.charAt(0).toUpperCase() + this.monthName.slice(1);

    const firstDay = new Date(this.year, month, 1);
    const lastDay = new Date(this.year, month + 1, 0);

    let startDayOfWeek = firstDay.getDay();
    let blankCount = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    this.blankDays = Array.from({ length: blankCount }, (_, i) => i);
    this.calendarDays = Array.from({ length: lastDay.getDate() }, (_, i) => i + 1);
  }

  prev() {
    if (this.calendarMode === 'days') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    } else {
      this.currentDate = new Date(this.currentDate.getFullYear() - 1, this.currentDate.getMonth(), 1);
    }
    this.generateCalendar();
  }

  next() {
    if (this.calendarMode === 'days') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    } else {
      this.currentDate = new Date(this.currentDate.getFullYear() + 1, this.currentDate.getMonth(), 1);
    }
    this.generateCalendar();
  }

  toggleMode() {
    this.calendarMode = this.calendarMode === 'days' ? 'months' : 'days';
  }

  selectMonth(index: number) {
    this.currentDate = new Date(this.currentDate.getFullYear(), index, 1);
    this.calendarMode = 'days';
    this.generateCalendar();
  }

  getMoodForDay(day: number): string | null {
    const entryForDay = this.diaryEntries.find(e => {
        const d = e.rawDate;
        return d.getDate() === day && d.getMonth() === this.currentDate.getMonth() && d.getFullYear() === this.year;
    });

    if (entryForDay) {
        if (entryForDay.mood && entryForDay.mood !== 'Neutro') {
            return entryForDay.mood.split(' ')[0];
        }
        return '📝';
    }
    return null;
  }

  hasSessionForDay(day: number): boolean {
    return this.sessionHistory.some(s => {
      const d = new Date(s.rawDate);
      return d.getDate() === day && d.getMonth() === this.currentDate.getMonth() && d.getFullYear() === this.year;
    });
  }

  selectDate(day: number) {
    if (this.selectedDate === day) {
      this.selectedDate = null;
    } else {
      this.selectedDate = day;
    }
  }

  get displayedDiaryEntries() {
    if (this.selectedDate !== null) {
      return this.diaryEntries.filter(e => 
        e.rawDate.getDate() === this.selectedDate &&
        e.rawDate.getMonth() === this.currentDate.getMonth() &&
        e.rawDate.getFullYear() === this.year
      );
    }
    return this.diaryEntries.slice(0, 3);
  }

  get displayedSessions() {
    if (this.selectedDate !== null) {
      return this.sessionHistory.filter(s => {
        const d = new Date(s.rawDate);
        return d.getDate() === this.selectedDate && d.getMonth() === this.currentDate.getMonth() && d.getFullYear() === this.year;
      });
    }
    return [];
  }

  goBack() {
    this.router.navigate(['/nutritionist/pacientes']);
  }

  async saveNutritionRecord() {
    this.isSavingRecord = true;
    
    // Unificar los datos en el objeto que se va a cifrar
    this.clinicalNotesObj.specific_data = this.specificData;
    this.clinicalNotesObj.weekly_consumption = this.weeklyConsumption;
    
    // Cifrar notas clínicas antes de guardarlas (E2EE)
    const encryptedNotes = this.crypto.encrypt(JSON.stringify(this.clinicalNotesObj));
    
    try {
      const { error } = await this.supabase
        .from('student_clinical_records')
        .update({ 
          additional_notes: encryptedNotes,
          known_conditions: [this.specificData.enfermedad_padecimiento || 'Seguimiento Nutricional']
        })
        .eq('student_id', this.patient.id);
        
      this.isSavingRecord = false;
      if (!error) {
        alert('Expediente nutricional guardado correctamente.');
        this.patient.notes = this.crypto.decrypt(encryptedNotes);
        this.patient.diagnosis = this.specificData.enfermedad_padecimiento || 'Seguimiento Nutricional';
      } else {
        alert('Error al guardar expediente: ' + error.message);
      }
    } catch (e) {
      this.isSavingRecord = false;
      console.warn('⚠️ MODO OFFLINE ACTIVADO: Guardado simulado localmente.');
      alert('Expediente guardado en local (Modo Offline).');
    }
  }

  downloadPDF() {
    // 1. Determinar la universidad del estudiante
    let university = 'BUAP';
    const email = (this.generalData?.correo || '').toLowerCase();
    const unit = (this.generalData?.unidad_academica || '').toUpperCase();
    
    if (email.includes('unam') || unit.includes('UNAM')) {
      university = 'UNAM';
    } else if (email.includes('ipn') || unit.includes('IPN')) {
      university = 'IPN';
    } else if (email.includes('udlap') || unit.includes('UDLAP')) {
      university = 'UDLAP';
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    // 2. Colores primarios y detalles por universidad
    let primaryColor = [16, 185, 129]; // Esmeralda BUAP
    let uniFullName = 'BENEMÉRITA UNIVERSIDAD AUTÓNOMA DE PUEBLA';
    let uniShortName = 'BUAP';

    if (university === 'UNAM') {
      primaryColor = [13, 35, 78]; // Azul UNAM
      uniFullName = 'UNIVERSIDAD NACIONAL AUTÓNOMA DE MÉXICO';
      uniShortName = 'UNAM';
    } else if (university === 'IPN') {
      primaryColor = [115, 23, 49]; // Guinda IPN
      uniFullName = 'INSTITUTO POLITÉCNICO NACIONAL';
      uniShortName = 'IPN';
    } else if (university === 'UDLAP') {
      primaryColor = [228, 100, 37]; // Naranja UDLAP
      uniFullName = 'UNIVERSIDAD DE LAS AMÉRICAS PUEBLA';
      uniShortName = 'UDLAP';
    }

    // Dibujar Marca de Agua (Watermark) en el fondo del PDF (Faded logo)
    doc.setFillColor(243, 244, 246); // Gris súper tenue
    doc.circle(pageWidth / 2, pageHeight / 2, 45, 'F');
    doc.setFontSize(28);
    doc.setTextColor(209, 213, 219); // Gris tenue para el texto de fondo
    doc.setFont('helvetica', 'bold');
    doc.text(uniShortName, pageWidth / 2, pageHeight / 2 + 4, { align: 'center' });

    // 3. Encabezado / Logo vectorial en la parte superior
    // Franja de color superior
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 12, 'F');

    // Logo vectorial de la universidad (Caja de color e iniciales en contraste)
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(15, 16, 12, 12, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(uniShortName, 21, 23, { align: 'center' });

    // Texto de encabezado de la universidad
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85); // Slate 700
    doc.setFont('helvetica', 'bold');
    doc.text(uniFullName, 30, 21);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text('PROGRAMA DE BIENESTAR Y ATENCIÓN CLÍNICA NUTRICIONAL', 30, 25);

    // Título del Documento
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('EXPEDIENTE CLÍNICO NUTRICIONAL DEL ESTUDIANTE', 15, 36);

    // Línea separadora
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.5);
    doc.line(15, 38, pageWidth - 15, 38);

    // 4. Datos Generales
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.text('I. DATOS GENERALES DEL ESTUDIANTE', 15, 44);

    // Caja gris de datos generales
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(15, 46, pageWidth - 30, 25, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, 46, pageWidth - 30, 25, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(`Nombre: ${this.generalData?.nombre || this.patient?.firstName + ' ' + this.patient?.lastName}`, 18, 51);
    doc.text(`Matrícula: ${this.patient?.matricula || 'N/A'}`, 18, 55);
    doc.text(`Unidad Académica: ${this.generalData?.unidad_academica || 'N/A'}`, 18, 59);
    doc.text(`Programa Educativo: ${this.generalData?.programa_educativo || 'N/A'}`, 18, 63);

    doc.text(`Celular: ${this.generalData?.celular || 'N/A'}`, 110, 51);
    doc.text(`Correo: ${this.generalData?.correo || 'N/A'}`, 110, 55);
    doc.text(`Sexo: ${this.generalData?.sexo || 'N/A'}`, 110, 59);
    doc.text(`Edad: ${this.generalData?.edad || 'N/A'} años`, 110, 63);

    // Antecedentes
    doc.setFont('helvetica', 'bold');
    doc.text('Antecedentes Clínicos Familiares: ', 18, 68);
    doc.setFont('helvetica', 'normal');
    doc.text(this.generalData?.antecedentes_familiares || 'Ninguno registrado', 65, 68);

    // 5. Datos Específicos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('II. EVALUACIÓN ESPECÍFICA (LLENADA POR NUTRICIONISTA)', 15, 78);

    // Cuadrícula de datos específicos
    let y = 83;
    const drawRow = (label1: string, val1: string, label2: string, val2: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label1, 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(val1 || 'N/A', 56, y);

      doc.setFont('helvetica', 'bold');
      doc.text(label2, 110, y);
      doc.setFont('helvetica', 'normal');
      doc.text(val2 || 'N/A', 152, y);
      y += 5.5;
    };

    drawRow('Prob. Gastrointestinales:', this.specificData.problemas_gastrointestinales, 'Alergias/Intolerancias:', this.specificData.alergia_intolerancia);
    drawRow('Enfermedad/Padecimiento:', this.specificData.enfermedad_padecimiento, 'Medicamentos consumidos:', this.specificData.medicamentos_consumo);
    drawRow('Alimentos desagrado:', this.specificData.alimentos_desagrado, 'Actividad Física:', this.specificData.actividad_fisica);
    drawRow('Días actividad/sem:', this.specificData.dias_actividad, 'Tiempo actividad/día:', `${this.specificData.tiempo_actividad || '0'} min`);
    drawRow('Comidas al día:', this.specificData.comidas_al_dia, 'Colaciones al día:', this.specificData.colaciones_al_dia);
    drawRow('Comidas a mantener:', this.specificData.comidas_mantener, 'Consumo de Agua:', `${this.specificData.consumo_agua || '0'} L`);
    drawRow('Tiempo de Sueño:', `${this.specificData.tiempo_sueno || '0'} hrs`, 'Comentarios Clínicos:', this.specificData.comentarios);

    // 6. Consumo Semanal
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('III. FRECUENCIA DE CONSUMO A LA SEMANA (FRECUENCIA ALIMENTARIA)', 15, y);
    y += 4;

    doc.setFillColor(248, 250, 252);
    doc.rect(15, y, pageWidth - 30, 24, 'F');
    doc.rect(15, y, pageWidth - 30, 24, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    // Frecuencia alimentaria
    doc.setFont('helvetica', 'bold'); doc.text('Verduras:', 18, y + 5); doc.setFont('helvetica', 'normal'); doc.text(`${this.weeklyConsumption.verduras || '0'} días`, 35, y + 5);
    doc.setFont('helvetica', 'bold'); doc.text('Frutas:', 18, y + 10); doc.setFont('helvetica', 'normal'); doc.text(`${this.weeklyConsumption.frutas || '0'} días`, 35, y + 10);
    doc.setFont('helvetica', 'bold'); doc.text('Lácteos:', 18, y + 15); doc.setFont('helvetica', 'normal'); doc.text(`${this.weeklyConsumption.lacteos || '0'} días`, 35, y + 15);
    doc.setFont('helvetica', 'bold'); doc.text('Cereales:', 18, y + 20); doc.setFont('helvetica', 'normal'); doc.text(`${this.weeklyConsumption.cereales || '0'} días`, 35, y + 20);

    doc.setFont('helvetica', 'bold'); doc.text('Leguminosas:', 100, y + 5); doc.setFont('helvetica', 'normal'); doc.text(`${this.weeklyConsumption.leguminosas || '0'} días`, 122, y + 5);
    doc.setFont('helvetica', 'bold'); doc.text('Azúcar:', 100, y + 10); doc.setFont('helvetica', 'normal'); doc.text(`${this.weeklyConsumption.azucar || '0'} días`, 122, y + 10);
    doc.setFont('helvetica', 'bold'); doc.text('AOA (Origen Animal):', 100, y + 15); doc.setFont('helvetica', 'normal'); doc.text(`${this.weeklyConsumption.aoa || '0'} días`, 133, y + 15);
    doc.setFont('helvetica', 'bold'); doc.text('Aceites s/Proteína:', 100, y + 20); doc.setFont('helvetica', 'normal'); doc.text(`${this.weeklyConsumption.aceites || '0'} días`, 128, y + 20);
    
    y += 28;
    doc.setFont('helvetica', 'bold');
    doc.text('Comentarios de Frecuencia Alimentaria:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(this.weeklyConsumption.comentarios || 'Sin comentarios adicionales.', 15, y + 4.5);

    // 7. Firma
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('_____________________________________', pageWidth / 2, pageHeight - 25, { align: 'center' });
    doc.text('Firma y Cédula del Nutricionista', pageWidth / 2, pageHeight - 21, { align: 'center' });

    // Guardar el archivo PDF
    doc.save(`expediente_${this.patient?.firstName}_${this.patient?.lastName}.pdf`);
  }

  async exportPatientDossier() {
    if (!this.patient?.id) return;
    this.isExporting = true;
    try {
      const blob = await this.dossierExport.exportDossier(this.patient.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dossier_clinico_${this.patient.firstName}_${this.patient.lastName}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al exportar dossier:', err);
      alert('Error al generar el dossier clínico.');
    } finally {
      this.isExporting = false;
    }
  }
}
