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

  // Convierte una imagen (logo original) a color blanco para mostrar en la franja azul, haciendo transparente el fondo blanco o transparente
  private async convertImageToWhite(base64Str: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // Si el píxel es transparente o es de fondo (blanco o muy claro)
            if (a <= 10 || (r >= 235 && g >= 235 && b >= 235)) {
              data[i + 3] = 0; // Hacer totalmente transparente
            } else {
              // Convertir el trazo / contenido de color en blanco puro
              data[i] = 255;     // R
              data[i + 1] = 255; // G
              data[i + 2] = 255; // B
              data[i + 3] = 255; // Hacer opaco
            }
          }
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => resolve(base64Str);
      img.src = base64Str;
    });
  }

  // Convierte una imagen a una versión semitransparente para marca de agua sutil, quitando el fondo blanco/claro
  private async convertImageToWatermark(base64Str: string, opacity: number = 0.04): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // Si es blanco o muy claro, hacerlo totalmente transparente
            if (a <= 10 || (r >= 235 && g >= 235 && b >= 235)) {
              data[i + 3] = 0;
            } else {
              // De lo contrario, aplicar la opacidad deseada al trazo original
              data[i + 3] = Math.round(a * opacity);
            }
          }
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => resolve(base64Str);
      img.src = base64Str;
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
    const { data: studentData, error: studentError } = await this.supabase
      .from('users')
      .select(`
        id, 
        role_id, 
        profiles(first_name, last_name), 
        student_clinical_records!student_clinical_records_student_id_fkey(
          known_conditions, 
          additional_notes,
          primary_psychologist:users!primary_psychologist_id(profiles(first_name, last_name)),
          primary_nutritionist:users!primary_nutritionist_id(profiles(first_name, last_name))
        )
      `)
      .eq('id', patientId)
      .single();

    if (studentError) throw studentError;

    const studentAny = studentData as any;
    const profile = Array.isArray(studentAny.profiles) ? studentAny.profiles[0] : studentAny.profiles;

    // Aplanar student para mantener compatibilidad con exportDossier
    const student = {
      id: studentAny.id,
      role_id: studentAny.role_id,
      first_name: profile?.first_name || 'Paciente',
      last_name: profile?.last_name || '',
      email: '', // No disponible en tablas públicas por HIPAA/Zero-Trust
      student_clinical_records: studentAny.student_clinical_records
    };

    // Desencriptar notas confidenciales si existen
    const rawClinicalRecord = studentAny
      ? (studentAny.student_clinical_records || studentAny['student_clinical_records!student_clinical_records_student_id_fkey'])
      : null;
    const clinicalRecord: any = Array.isArray(rawClinicalRecord)
      ? rawClinicalRecord[0]
      : rawClinicalRecord;

    let psychologistName = 'No asignado';
    let nutritionistName = 'No asignado';

    if (clinicalRecord) {
      const psy = Array.isArray(clinicalRecord.primary_psychologist) ? clinicalRecord.primary_psychologist[0] : clinicalRecord.primary_psychologist;
      const psyProfile = psy ? (Array.isArray(psy.profiles) ? psy.profiles[0] : psy.profiles) : null;
      if (psyProfile) {
        psychologistName = `${psyProfile.first_name || ''} ${psyProfile.last_name || ''}`.trim();
      }

      const nut = Array.isArray(clinicalRecord.primary_nutritionist) ? clinicalRecord.primary_nutritionist[0] : clinicalRecord.primary_nutritionist;
      const nutProfile = nut ? (Array.isArray(nut.profiles) ? nut.profiles[0] : nut.profiles) : null;
      if (nutProfile) {
        nutritionistName = `${nutProfile.first_name || ''} ${nutProfile.last_name || ''}`.trim();
      }
    }

    let decryptedNotes = '';
    if (clinicalRecord?.additional_notes) {
      try {
        const decrypted = this.crypto.decrypt(clinicalRecord.additional_notes);
        try {
          const parsed = JSON.parse(decrypted);
          if (parsed && typeof parsed === 'object') {
            if (parsed.notes) {
              decryptedNotes = parsed.notes;
            } else if (parsed.additional_notes) {
              decryptedNotes = parsed.additional_notes;
            } else if (parsed.general_data?.notes) {
              decryptedNotes = parsed.general_data.notes;
            } else {
              let summary = 'Respuestas de Evaluación Inicial:';
              Object.keys(parsed).forEach(key => {
                if (key.startsWith('q')) {
                  summary += `\n- Pregunta ${key.substring(1)}: ${parsed[key]}`;
                }
              });
              decryptedNotes = summary;
            }
          } else {
            decryptedNotes = decrypted;
          }
        } catch (jsonErr) {
          decryptedNotes = decrypted;
        }
      } catch (e) {
        decryptedNotes = 'Error al desencriptar notas.';
      }
    }

    // 2. Citas completadas (Notas SOAP)
    const { data: appointmentsRaw, error: apptError } = await this.supabase
      .from('appointments')
      .select('scheduled_date, start_time, end_time, status, notes, cancellation_reason, emergency_change_details, professional_id, professional:users!professional_id(profiles(first_name, last_name))')
      .eq('student_id', patientId)
      .order('scheduled_date', { ascending: false });

    if (apptError) throw apptError;

    const appointments = (appointmentsRaw ?? []).map((appt: any) => {
      const professional = Array.isArray(appt.professional) ? appt.professional[0] : appt.professional;
      const profProfile = Array.isArray(professional?.profiles) ? professional.profiles[0] : professional?.profiles;
      const fullName = profProfile ? `${profProfile.first_name || ''} ${profProfile.last_name || ''}`.trim() : 'Especialista';
      return {
        ...appt,
        profiles: {
          full_name: fullName
        }
      };
    });

    if (apptError) throw apptError;

    // 3. Bitácora alimentaria y nutricional
    const { data: nutritionLogs, error: nutritionError } = await this.supabase
      .from('nutrition_logs')
      .select('id, log_date, total_calories, total_protein, total_carbs, total_fats, food_items(*)')
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
    let sessionEvaluations: any[] = [];
    try {
      const { data, error } = await this.supabase
        .from('session_evaluations')
        .select('score_global, rupture_flag, created_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        sessionEvaluations = data;
      } else if (error) {
        console.warn('Advertencia obteniendo evaluaciones post-sesión (posiblemente la tabla no esté migrada):', error);
      }
    } catch (e) {
      console.warn('Excepción obteniendo evaluaciones post-sesión:', e);
    }

    // 6. Imagen de Marca de Agua Institucional (Skill 8)
    let watermarkUrl: string | null = null;
    try {
      const { data: listData, error: listError } = await this.supabase.storage.from('institutional_assets').list();
      if (!listError) {
        const hasWatermark = listData?.some((file: any) => file.name === 'watermark_logo.png');
        if (hasWatermark) {
          const { data } = await this.supabase.storage.from('institutional_assets').getPublicUrl('watermark_logo.png');
          if (data && data.publicUrl) {
            watermarkUrl = data.publicUrl + '?ts=' + new Date().getTime();
          }
        }
      }
    } catch (e) {
      console.warn('No se pudo verificar el bucket institutional_assets:', e);
    }

    // 7. Nombre de la Institución Dinámica (Skill 8.4)
    let institutionName = 'BENEMÉRITA UNIVERSIDAD AUTÓNOMA DE PUEBLA';
    try {
      const { data: instData, error: instError } = await this.supabase
        .from('institutional_settings')
        .select('institution_name')
        .eq('id', 1)
        .maybeSingle();
      if (!instError && instData && instData.institution_name) {
        institutionName = instData.institution_name.toUpperCase();
      }
    } catch (e) {
      console.warn('Error al obtener la configuración institucional:', e);
    }

    return {
      student,
      clinicalRecord,
      decryptedNotes,
      appointments: appointments ?? [],
      nutritionLogs: nutritionLogs ?? [],
      diaryEntries: decryptedDiary,
      sessionEvaluations: sessionEvaluations,
      watermarkUrl: watermarkUrl,
      institutionName: institutionName,
      psychologistName,
      nutritionistName
    };
  }

  // Orquesta la generación y exportación del dossier clínico completo a PDF usando jsPDF
  async exportDossier(patientId: string): Promise<Blob> {
    const data = await this.getDossierData(patientId);
    const patientName = `${data.student.first_name || ''} ${data.student.last_name || ''}`.trim();

    // Obtener los datos del especialista (profesional) que realiza la exportación
    let exporterId = 'unknown_id';
    let exporterEmail = 'unknown_email';
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (user) {
        exporterId = user.id;
        exporterEmail = user.email || 'unknown_email';
      }
    } catch (e) {
      console.warn('Error al obtener el usuario de exportación en Meta Seal:', e);
    }

    // 1. Construir la cadena de texto de verificación para el sello de integridad (No Repudio + Trazabilidad de Explotación)
    let payloadStr = `PatientId:${patientId}|Name:${patientName}|ExporterId:${exporterId}|ExporterEmail:${exporterEmail}`;
    data.appointments.forEach((a: any) => {
      payloadStr += `|ApptDate:${a.scheduled_date}|Notes:${a.notes}`;
    });
    data.diaryEntries.forEach((d: any) => {
      payloadStr += `|DiaryDate:${d.created_at}|Content:${d.decryptedContent}`;
    });

    const metaSealHash = await this.generateHMAC(payloadStr, 'AMATI_NOM024_SECRET_KEY');

    // Cargar y procesar el logo de la universidad (en blanco y marca de agua)
    let watermarkBase64: string | null = null;
    let whiteLogoBase64: string | null = null;
    if (data.watermarkUrl) {
      try {
        const base64 = await this.getBase64ImageFromURL(data.watermarkUrl);
        whiteLogoBase64 = await this.convertImageToWhite(base64);
        watermarkBase64 = await this.convertImageToWatermark(base64, 0.05); // 5% opacidad
      } catch (e) {
        console.warn('Error procesando imagen del logo para marca de agua:', e);
      }
    }

    // 2. Crear instancia de jsPDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 3. Dibujar marca de agua y pie de página sutil (Powered by Amati)
    const drawWatermark = () => {
      if (watermarkBase64) {
        const size = 120; // 12 cm de ancho/alto
        doc.addImage(watermarkBase64, 'PNG', (pageWidth - size) / 2, (pageHeight - size) / 2, size, size);
      } else {
        // Fallback de texto
        doc.setFontSize(20);
        doc.setTextColor(240, 242, 245);
        doc.setFont('helvetica', 'bold');
        doc.text(data.institutionName, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
      }

      // Pie de página sutil (Powered by Amati)
      doc.setFontSize(8);
      doc.setTextColor(160, 174, 192); // Slate 400
      doc.setFont('helvetica', 'normal');
      doc.text('Powered by Amati', pageWidth / 2, pageHeight - 8, { align: 'center' });

      // Leyenda de seguridad roja vertical en el margen derecho (sin emoji para evitar encoding garbled, y rotado 270 grados para leerse de arriba a abajo en la mitad inferior de la página)
      doc.setFontSize(7);
      doc.setTextColor(220, 38, 38); // Rojo
      doc.setFont('helvetica', 'bold');
      doc.text('CONFIDENCIAL - ESTE DOCUMENTO INCLUYE INFORMACIÓN SENSIBLE - MANEJAR CON CUIDADO', pageWidth - 5, 145, { angle: 270 });
    };

    // 4. Dibujar encabezado institucional (franja azul + logo grande centrado + nombre abajo)
    const drawHeader = () => {
      // Franja superior azul de 30 mm de alto para acomodar el logo de 2 cm centrado
      doc.setFillColor(30, 58, 138); // Navy blue
      doc.rect(0, 0, pageWidth, 30, 'F');

      if (whiteLogoBase64) {
        const logoSize = 20; // Logo superior aumentado a 2 cm (20 mm)
        doc.addImage(whiteLogoBase64, 'PNG', (pageWidth - logoSize) / 2, 2, logoSize, logoSize);
        
        // Nombre de la institución en blanco en la franja, centrado en la parte de abajo
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(data.institutionName, pageWidth / 2, 26, { align: 'center' });
      } else {
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(data.institutionName, pageWidth / 2, 17, { align: 'center' });
      }
    };

    drawWatermark();
    drawHeader();

    // Título del documento (bajado para dar espacio a la franja de 30 mm)
    doc.setFontSize(14);
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text('DOSSIER CLÍNICO UNIFICADO (NOM-024 / HIPAA)', 15, 38);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(`Sello Digital de Integridad (Meta Seal): ${metaSealHash}`, 15, 42);

    // Línea divisoria
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 44, pageWidth - 15, 44);

    let y = 51;

    // Resumen ejecutivo
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.text('I. RESUMEN CLÍNICO EJECUTIVO', 15, y);
    y += 5;

    doc.setFillColor(248, 250, 252);
    doc.rect(15, y, pageWidth - 30, 27, 'F');
    doc.rect(15, y, pageWidth - 30, 27, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Paciente: ${patientName}`, 18, y + 5);
    doc.text(`Matrícula/ID: ${data.student.id}`, 18, y + 10);
    doc.text(`Especialistas Tratantes: Psic. ${data.psychologistName || 'No asignado'} | Nut. ${data.nutritionistName || 'No asignado'}`, 18, y + 15);
    doc.text(`Condiciones: ${data.student.student_clinical_records?.known_conditions?.join(', ') || 'Ninguna registrada'}`, 18, y + 20);
    doc.text(`Sello HMAC: ${metaSealHash.substring(0, 32)}...`, 18, y + 25);

    y += 37;

    // Validador de cambio de página
    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 20) {
        doc.addPage();
        drawWatermark();
        drawHeader();
        y = 38; // reset y para iniciar después del encabezado de 30mm
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
        const timeStr = a.start_time ? a.start_time.substring(0, 5) : '';
        const titleText = `Sesión del día ${dateStr}` + (timeStr ? ` a las ${timeStr}` : '') + ` con ${a.profiles?.full_name || 'Especialista'}`;
        doc.text(titleText, 15, y);

        // Dibujar estado de asistencia/cancelación en el extremo derecho (traducido a español)
        let statusText = '';
        let statusColor = [100, 116, 139];
        switch (a.status) {
          case 'completed':
            statusText = 'Asistió';
            statusColor = [16, 185, 129]; // Verde esmeralda
            break;
          case 'absent':
            statusText = 'Se ausentó';
            statusColor = [239, 68, 68]; // Rojo
            break;
          case 'rescheduled':
            statusText = 'Se reprogramó';
            statusColor = [245, 158, 11]; // Ámbar
            break;
          case 'canceled':
          case 'cancelled':
            statusText = 'Cancelada';
            statusColor = [220, 38, 38]; // Rojo oscuro
            break;
          case 'scheduled':
            statusText = 'Programada';
            statusColor = [59, 130, 246]; // Azul
            break;
          default:
            statusText = a.status ? a.status.charAt(0).toUpperCase() + a.status.slice(1) : 'Programada';
            if (statusText === 'Scheduled') statusText = 'Programada';
            if (statusText === 'Canceled') statusText = 'Cancelada';
            break;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.text(statusText, pageWidth - 15, y, { align: 'right' });

        y += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);

        let noteContent = a.notes ? a.notes
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim() : '';

        if (a.status === 'canceled') {
          const reason = a.cancellation_reason || a.emergency_change_details || 'No especificada';
          noteContent = `Razón de cancelación: ${reason}` + (noteContent ? `\nNotas del Especialista: ${noteContent}` : '');
        } else if (!noteContent) {
          noteContent = 'Sin notas.';
        }

        const splitNotes = doc.splitTextToSize(noteContent, pageWidth - 30);
        
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
        doc.text(`Fecha: ${dateStr} - Resumen Diario: ${log.total_calories || 0} kcal (P: ${log.total_protein || 0}g, C: ${log.total_carbs || 0}g, G: ${log.total_fats || 0}g)`, 15, y);
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

    // 8. Numeración de páginas dinámica al final de la generación (Página N de M) sin encimarse
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(160, 174, 192); // Slate 400
      doc.setFont('helvetica', 'normal');
      doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 14, { align: 'center' });
    }

    const pdfBlob = doc.output('blob');
    return pdfBlob;
  }
}
