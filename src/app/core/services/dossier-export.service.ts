import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { CryptoService } from './crypto.service';
import { jsPDF } from 'jspdf';

@Injectable({
  providedIn: 'root'
})
export class DossierExportService {
  private supabase = inject(SupabaseService).supabase;
  private crypto = inject(CryptoService);

  // Convierte una imagen de URL pública a Base64
  private async getBase64ImageFromURL(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.setAttribute('crossOrigin', 'anonymous');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/png');
          resolve(dataURL);
        } else {
          reject(new Error('Could not get 2D context'));
        }
      };
      img.onerror = (error) => {
        reject(error);
      };
      img.src = url;
    });
  }

  // Genera hash HMAC-SHA256 usando Web Crypto API
  private async generateHMAC(message: string, secretKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(message);

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Recupera todos los datos consolidados del expediente del paciente
  async getDossierData(patientId: string): Promise<any> {
    // 1. Perfil del estudiante e historial clínico
    const { data: student, error: studentError } = await this.supabase
      .from('users')
      .select('id, email, first_name, last_name, role_id, student_clinical_records(known_conditions, additional_notes)')
      .eq('id', patientId)
      .single();

    if (studentError) throw studentError;

    // Desencriptar notas confidenciales si existen
    const clinicalRecord: any = Array.isArray(student.student_clinical_records)
      ? student.student_clinical_records[0]
      : student.student_clinical_records;

    let decryptedNotes = '';
    if (clinicalRecord?.additional_notes) {
      try {
        decryptedNotes = this.crypto.decrypt(clinicalRecord.additional_notes);
      } catch (e) {
        decryptedNotes = 'Error al desencriptar notas.';
      }
    }

    // 2. Citas completadas (Notas SOAP)
    const { data: appointments, error: apptError } = await this.supabase
      .from('appointments')
      .select('scheduled_date, start_time, end_time, status, notes, professional_id, profiles:professional_id(full_name)')
      .eq('student_id', patientId)
      .order('scheduled_date', { ascending: false });

    if (apptError) throw apptError;

    // 3. Bitácora alimentaria y nutricional
    const { data: nutritionLogs, error: nutritionError } = await this.supabase
      .from('nutrition_logs')
      .select('id, log_date, notes, food_items(*)')
      .eq('student_id', patientId)
      .order('log_date', { ascending: false });

    if (nutritionError) throw nutritionError;

    // 4. Diario emocional
    const { data: diaryEntries, error: diaryError } = await this.supabase
      .from('diary_entries')
      .select('content, moods, high_risk, created_at')
      .eq('student_id', patientId)
      .order('created_at', { ascending: false });

    if (diaryError) throw diaryError;

    // Desencriptar entradas
    const decryptedDiary = (diaryEntries ?? []).map(entry => {
      let decContent = '';
      try {
        decContent = this.crypto.decrypt(entry.content);
      } catch (e) {
        decContent = 'Error al desencriptar entrada del diario.';
      }
      return {
        ...entry,
        decryptedContent: decContent
      };
    });

    // 5. Evaluaciones de alianza terapéutica (FIT)
    const { data: sessionEvaluations, error: evalError } = await this.supabase
      .from('session_evaluations')
      .select('score_global, rupture_flag, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (evalError) throw evalError;

    // 6. Imagen de Marca de Agua Institucional (Skill 8)
    const { data: instSettings } = await this.supabase
      .from('institutional_settings')
      .select('watermark_url')
      .maybeSingle();

    return {
      student,
      clinicalRecord,
      decryptedNotes,
      appointments: appointments ?? [],
      nutritionLogs: nutritionLogs ?? [],
      diaryEntries: decryptedDiary,
      sessionEvaluations: sessionEvaluations ?? [],
      watermarkUrl: instSettings?.watermark_url || null
    };
  }

  // Orquesta la generación y exportación del dossier clínico completo a PDF usando jsPDF
  async exportDossier(patientId: string): Promise<Blob> {
    const data = await this.getDossierData(patientId);
    const patientName = `${data.student.first_name || ''} ${data.student.last_name || ''}`.trim();

    // 1. Construir la cadena de texto de verificación para el sello de integridad (No Repudio)
    let payloadStr = `PatientId:${patientId}|Name:${patientName}`;
    data.appointments.forEach((a: any) => {
      payloadStr += `|ApptDate:${a.scheduled_date}|Notes:${a.notes}`;
    });
    data.diaryEntries.forEach((d: any) => {
      payloadStr += `|DiaryDate:${d.created_at}|Content:${d.decryptedContent}`;
    });

    const metaSealHash = await this.generateHMAC(payloadStr, 'AMATI_NOM024_SECRET_KEY');

    // 2. Crear instancia de jsPDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 3. Dibujar marca de agua
    const drawWatermark = () => {
      doc.setFontSize(28);
      doc.setTextColor(240, 242, 245);
      doc.setFont('helvetica', 'bold');
      doc.text('AMATI CLÍNICO • BUAP', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
    };

    drawWatermark();

    // 4. Franja superior
    doc.setFillColor(30, 58, 138); // Navy blue
    doc.rect(0, 0, pageWidth, 12, 'F');

    // Título del documento
    doc.setFontSize(14);
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text('DOSSIER CLÍNICO UNIFICADO (NOM-024 / HIPAA)', 15, 22);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(`Sello Digital de Integridad (Meta Seal): ${metaSealHash}`, 15, 26);

    // Línea divisoria
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 28, pageWidth - 15, 28);

    let y = 35;

    // Resumen ejecutivo
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.text('I. RESUMEN CLÍNICO EJECUTIVO', 15, y);
    y += 5;

    doc.setFillColor(248, 250, 252);
    doc.rect(15, y, pageWidth - 30, 28, 'F');
    doc.rect(15, y, pageWidth - 30, 28, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Paciente: ${patientName}`, 18, y + 5);
    doc.text(`Matrícula/ID: ${data.student.id}`, 18, y + 10);
    doc.text(`Correo: ${data.student.email || 'N/A'}`, 18, y + 15);
    doc.text(`Condiciones: ${data.student.student_clinical_records?.known_conditions?.join(', ') || 'Ninguna registrada'}`, 18, y + 20);
    doc.text(`Sello HMAC: ${metaSealHash.substring(0, 32)}...`, 18, y + 25);

    y += 38;

    // Validador de cambio de página
    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 20) {
        doc.addPage();
        drawWatermark();
        y = 20; // reset y
      }
    };

    // Notas SOAP
    checkPageBreak(15);
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text('II. NOTAS DE EVOLUCIÓN CLÍNICA (SOAP)', 15, y);
    y += 6;

    if (data.appointments.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('No se encontraron notas clínicas de evolución registradas.', 15, y);
      y += 6;
    } else {
      data.appointments.forEach((a: any) => {
        checkPageBreak(25);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const dateStr = new Date(a.scheduled_date).toLocaleDateString();
        doc.text(`Sesión del día ${dateStr} con ${a.profiles?.full_name || 'Especialista'}`, 15, y);
        y += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        const cleanNotes = a.notes ? a.notes.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n').trim() : 'Sin notas.';
        const splitNotes = doc.splitTextToSize(cleanNotes, pageWidth - 30);
        
        splitNotes.forEach((line: string) => {
          checkPageBreak(5);
          doc.text(line, 15, y);
          y += 4.5;
        });
        y += 3;
      });
    }

    // Registros nutricionales
    checkPageBreak(15);
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text('III. BITÁCORA Y DIARIO ALIMENTARIO', 15, y);
    y += 6;

    if (data.nutritionLogs.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('No se encontraron registros nutricionales.', 15, y);
      y += 6;
    } else {
      data.nutritionLogs.forEach((log: any) => {
        checkPageBreak(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const dateStr = new Date(log.log_date).toLocaleDateString();
        doc.text(`Fecha: ${dateStr} - Nota: ${log.notes || 'Sin observaciones'}`, 15, y);
        y += 5;

        if (log.food_items && log.food_items.length > 0) {
          log.food_items.forEach((item: any) => {
            checkPageBreak(6);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.text(`• ${item.name} (${item.amount || '-'}): ${item.calories || 0} kcal, P: ${item.protein || 0}g, C: ${item.carbs || 0}g, G: ${item.fat || 0}g`, 18, y);
            y += 5;
          });
        }
        y += 2;
      });
    }

    // Diario emocional
    checkPageBreak(15);
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text('IV. DIARIO EMOCIONAL', 15, y);
    y += 6;

    if (data.diaryEntries.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('No se encontraron entradas en el diario emocional.', 15, y);
      y += 6;
    } else {
      data.diaryEntries.forEach((entry: any) => {
        checkPageBreak(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const dateStr = new Date(entry.created_at).toLocaleString();
        doc.text(`Fecha: ${dateStr} | Ánimo: ${entry.moods?.join(', ') || 'Neutro'} ${entry.high_risk ? '⚠️' : ''}`, 15, y);
        y += 4;

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        const splitContent = doc.splitTextToSize(`"${entry.decryptedContent}"`, pageWidth - 30);
        splitContent.forEach((line: string) => {
          checkPageBreak(5);
          doc.text(line, 15, y);
          y += 4.5;
        });
        y += 2;
      });
    }

    // Evaluaciones FIT
    checkPageBreak(15);
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text('V. HISTORIAL DE ALIANZA TERAPÉUTICA (FIT)', 15, y);
    y += 6;

    if (data.sessionEvaluations.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('No se encontraron evaluaciones de sesión.', 15, y);
      y += 6;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Fecha', 15, y);
      doc.text('Calificación Ponderada', 60, y);
      doc.text('Diagnóstico Alianza', 120, y);
      y += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      data.sessionEvaluations.forEach((ev: any) => {
        checkPageBreak(6);
        const dateStr = new Date(ev.created_at).toLocaleDateString();
        doc.text(dateStr, 15, y);
        doc.text(`${ev.score_global} / 5.0`, 60, y);
        doc.text(ev.rupture_flag.toUpperCase(), 120, y);
        y += 5;
      });
    }

    // Definir propiedades de metadatos en el PDF
    doc.setProperties({
      title: `Expediente Clínico Unificado - ${patientName}`,
      author: 'Plataforma Emocional Amati',
      subject: `HMAC Integrity Seal: ${metaSealHash}`,
      keywords: `Amati, NOM-024, HIPAA, ${metaSealHash}`
    });

    const pdfBlob = doc.output('blob');
    return pdfBlob;
  }
}
