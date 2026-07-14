import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-nutritionist-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class NutritionistDashboardComponent implements OnInit {
  private supabase = inject(SupabaseService).supabase;
  private crypto = inject(CryptoService);
  private authService = inject(AuthService);

  loading = true;

  // KPIs
  myPatientsCount = 0;
  newPatientsThisMonth = 0;
  riskPatientsCount = 0;
  urgentPatientsCount = 0;
  consultsToday = 0;
  nextPatientText = 'Sin consultas';
  averageAdherence = 74;
  avgSleep = '7.2';
  avgWater = '2.0';

  criticalCases: any[] = [];
  agenda: any[] = [];
  alerts: any[] = [];

  // Gráfica de línea: Evolución del apego al plan alimentario semanal
  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
    datasets: [
      { data: [65, 70, 72, 78], label: 'Apego Alto', borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 207, 0.1)', tension: 0.4, fill: false },
      { data: [25, 22, 20, 15], label: 'Apego Medio', borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', tension: 0.4, fill: false },
      { data: [10, 8, 8, 7], label: 'Apego Bajo', borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.4, fill: false }
    ]
  };

  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { 
      x: { grid: { display: false } }, 
      y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } } 
    }
  };

  // Gráfica de dona: Objetivos Nutricionales
  public pieChartLabels = [ "Pérdida de Grasa", "Ganancia Muscular", "Manejo de Diabetes", "Rendimiento Deportivo", "Intolerancias / Otros" ];
  public pieChartValues = [ 42, 28, 12, 10, 8 ];
  public pieChartColors = [ '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#94a3b8' ];

  public pieChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: this.pieChartLabels,
    datasets: [ {
      data: this.pieChartValues,
      backgroundColor: this.pieChartColors,
      borderWidth: 0,
      hoverOffset: 4
    } ]
  };

  public pieChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: { legend: { display: false } }
  };

  get currentUserId() {
    return this.authService.currentUser()?.id;
  }

  async ngOnInit() {
    await this.loadDashboardData();
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

    return {
      score,
      hasRisk: score >= 20 || hasBehavioralRisk,
      behavioralRisk: hasBehavioralRisk
    };
  }

  async loadDashboardData() {
    this.loading = true;
    const currentUserId = this.currentUserId;
    if (!currentUserId) {
      this.loading = false;
      return;
    }

    try {
      // 1. Obtener todos los estudiantes asignados a este nutriólogo
      const { data: usersData, error: usersError } = await this.supabase
        .from('users')
        .select(`
          id,
          matricula,
          profiles (first_name, last_name, avatar_url, faculty),
          student_clinical_records!student_clinical_records_student_id_fkey (
            known_conditions,
            additional_notes,
            primary_nutritionist_id,
            created_at,
            updated_at
          )
        `)
        .eq('role_id', 2);

      if (usersError) {
        console.error('Error cargando pacientes:', usersError.message);
        this.loading = false;
        return;
      }

      // Filtrar asignados en memoria para evitar errores de consulta compleja de RLS en relaciones indirectas
      const myPatients = (usersData || []).filter((u: any) => {
        const records = u.student_clinical_records;
        const recordObj = Array.isArray(records) ? records[0] : records;
        return recordObj && recordObj.primary_nutritionist_id === currentUserId;
      });

      this.myPatientsCount = myPatients.length;

      // Calcular nuevos pacientes este mes (últimos 30 días)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      this.newPatientsThisMonth = myPatients.filter((u: any) => {
        const records = u.student_clinical_records;
        const recordObj = Array.isArray(records) ? records[0] : records;
        const date = recordObj?.created_at || recordObj?.updated_at;
        return date && new Date(date) >= thirtyDaysAgo;
      }).length;

      // 2. Procesar notas clínicas E2EE para pacientes con riesgo, padecimientos, sueño e hidratación
      const criticalList: any[] = [];
      let totalSleep = 0;
      let sleepCount = 0;
      let totalWater = 0;
      let waterCount = 0;

      let fatLoss = 0;
      let muscleGain = 0;
      let diabetesMgmt = 0;
      let sportsPerf = 0;
      let intolerances = 0;

      myPatients.forEach((u: any) => {
        const profile = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles;
        const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Estudiante';
        const records = u.student_clinical_records;
        const recordObj = Array.isArray(records) ? records[0] : records;
        
        let eat26: any = null;
        let parsedNotes: any = {};

        if (recordObj?.additional_notes) {
          try {
            const decNotes = this.crypto.decrypt(recordObj.additional_notes);
            parsedNotes = JSON.parse(decNotes);
            if (parsedNotes.q1) {
              eat26 = this.calculateEat26Score(parsedNotes);
            }
          } catch (e) {
            console.warn('Error al desencriptar notas de paciente:', u.id, e);
          }
        }

        // Extraer sueño e hidratación
        const sleep = Number(parsedNotes.specific_data?.tiempo_sueno);
        if (!isNaN(sleep) && sleep > 0) {
          totalSleep += sleep;
          sleepCount++;
        }
        const water = Number(parsedNotes.specific_data?.consumo_agua);
        if (!isNaN(water) && water > 0) {
          totalWater += water;
          waterCount++;
        }

        // Categorizar objetivo clínico
        const gastro = (parsedNotes.specific_data?.problemas_gastrointestinales || '').toLowerCase();
        const alergia = (parsedNotes.specific_data?.alergia_intolerancia || '').toLowerCase();
        const enfermedad = (parsedNotes.specific_data?.enfermedad_padecimiento || '').toLowerCase();
        const actividad = (parsedNotes.specific_data?.actividad_fisica || '').toLowerCase();

        if (enfermedad.includes('diabetes') || enfermedad.includes('glucosa') || enfermedad.includes('resistencia')) {
          diabetesMgmt++;
        } else if (alergia.length > 3 || gastro.length > 3) {
          intolerances++;
        } else if (actividad.includes('alto rendimiento') || actividad.includes('deporte') || actividad.includes('compet') || actividad.includes('atleta')) {
          sportsPerf++;
        } else if (actividad.includes('fuerza') || actividad.includes('pesos') || actividad.includes('gym') || actividad.includes('músculo')) {
          muscleGain++;
        } else {
          fatLoss++;
        }

        // Evaluar si es un caso prioritario (TCA, alergias graves, enfermedad descontrolada)
        if (eat26 && eat26.hasRisk) {
          criticalList.push({
            patient: name,
            risk: "HIGH",
            diagnosis: `Riesgo Alto TCA (EAT-26: ${eat26.score})`,
            lastContact: "Reciente",
            flag: "red",
            score: eat26.score
          });
        } else if (enfermedad && (enfermedad.includes('diabetes') || enfermedad.includes('hipertensión'))) {
          criticalList.push({
            patient: name,
            risk: "MODERATE",
            diagnosis: `Enfermedad: ${parsedNotes.specific_data.enfermedad_padecimiento}`,
            lastContact: "Reciente",
            flag: "amber",
            score: 0
          });
        } else if (alergia && (alergia.includes('severa') || alergia.includes('celía') || alergia.includes('gluten'))) {
          criticalList.push({
            patient: name,
            risk: "MODERATE",
            diagnosis: `Alergia: ${parsedNotes.specific_data.alergia_intolerancia}`,
            lastContact: "Reciente",
            flag: "amber",
            score: 0
          });
        } else if (gastro && (gastro.includes('dolor') || gastro.includes('sangre') || gastro.includes('severo'))) {
          criticalList.push({
            patient: name,
            risk: "MODERATE",
            diagnosis: `GI: ${parsedNotes.specific_data.problemas_gastrointestinales}`,
            lastContact: "Reciente",
            flag: "amber",
            score: 0
          });
        }
      });

      // Ordenar casos de atención prioritaria
      this.criticalCases = criticalList.sort((a, b) => {
        if (a.risk === 'HIGH' && b.risk !== 'HIGH') return -1;
        if (a.risk !== 'HIGH' && b.risk === 'HIGH') return 1;
        return b.score - a.score;
      }).slice(0, 5);

      this.riskPatientsCount = myPatients.filter((u: any) => {
        const records = u.student_clinical_records;
        const recordObj = Array.isArray(records) ? records[0] : records;
        if (recordObj?.additional_notes) {
          try {
            const decNotes = this.crypto.decrypt(recordObj.additional_notes);
            const parsed = JSON.parse(decNotes);
            if (parsed.q1) {
              return this.calculateEat26Score(parsed).hasRisk;
            }
          } catch(e) {}
        }
        return false;
      }).length;

      this.urgentPatientsCount = this.criticalCases.length;
      this.avgSleep = sleepCount > 0 ? (totalSleep / sleepCount).toFixed(1) : '7.2';
      this.avgWater = waterCount > 0 ? (totalWater / waterCount).toFixed(1) : '2.0';

      // 3. Agenda de Consultas de Hoy
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: appointments, error: apptError } = await this.supabase
        .from('appointments')
        .select(`
          id,
          scheduled_date,
          start_time,
          status,
          priority_level,
          notes,
          users!appointments_student_id_fkey (
            id,
            profiles (first_name, last_name)
          )
        `)
        .eq('professional_id', currentUserId)
        .gte('scheduled_date', `${todayStr}T00:00:00`)
        .lte('scheduled_date', `${todayStr}T23:59:59`);

      if (!apptError && appointments) {
        this.agenda = appointments.map((a: any) => {
          const student = a.users;
          const profile = student ? (Array.isArray(student.profiles) ? student.profiles[0] : student.profiles) : null;
          const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Paciente';
          const time = a.start_time ? a.start_time.substring(0, 5) : '00:00';
          
          let status = 'confirmed';
          if (a.status === 'absent' || a.status === 'cancelled' || a.status === 'canceled') {
            status = 'cancelled';
          } else if (a.priority_level === 'Urgent' || a.status === 'urgent') {
            status = 'urgent';
          } else if (a.status === 'pending') {
            status = 'pending';
          }

          return {
            time,
            patient: name,
            type: a.notes || 'Consulta Nutricional',
            duration: 30,
            status
          };
        }).sort((a, b) => a.time.localeCompare(b.time));

        this.consultsToday = this.agenda.filter(a => a.status !== 'cancelled').length;

        // Próxima consulta
        const now = new Date();
        const curTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const nextAppt = this.agenda.find(a => a.status !== 'cancelled' && a.time >= curTimeStr);
        this.nextPatientText = nextAppt ? `${nextAppt.patient} a las ${nextAppt.time}` : 'No hay más consultas hoy';
      }

      // 4. Calcular Apego Promedio desde bitácoras reales de los pacientes (últimos 7 días)
      const patientIds = myPatients.map(p => p.id);
      if (patientIds.length > 0) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: recentLogs } = await this.supabase
          .from('nutrition_logs')
          .select('student_id, log_date')
          .in('student_id', patientIds)
          .gte('log_date', sevenDaysAgo.toISOString().split('T')[0]);

        if (recentLogs && recentLogs.length > 0) {
          const totalLogsExpected = 7 * patientIds.length;
          const pct = Math.round((recentLogs.length / totalLogsExpected) * 100);
          this.averageAdherence = Math.min(100, Math.max(15, pct));
        } else {
          this.averageAdherence = 74; // default baseline
        }

        // 5. Gráfico de evolución semanal de registros de los últimos 28 días
        const twentyEightDaysAgo = new Date();
        twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
        const { data: monthlyLogs } = await this.supabase
          .from('nutrition_logs')
          .select('student_id, log_date')
          .in('student_id', patientIds)
          .gte('log_date', twentyEightDaysAgo.toISOString().split('T')[0]);

        if (monthlyLogs && monthlyLogs.length > 0) {
          const weeksData = [
            { alto: 0, medio: 0, bajo: 0 },
            { alto: 0, medio: 0, bajo: 0 },
            { alto: 0, medio: 0, bajo: 0 },
            { alto: 0, medio: 0, bajo: 0 }
          ];

          const today = new Date();
          const logsByPatientAndWeek: Record<string, number[]> = {};
          patientIds.forEach(id => { logsByPatientAndWeek[id] = [0, 0, 0, 0]; });

          monthlyLogs.forEach((log: any) => {
            const logDate = new Date(log.log_date);
            const diffDays = Math.ceil(Math.abs(today.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
            const weekIdx = Math.min(3, Math.floor((diffDays - 1) / 7));
            const mappedIdx = 3 - weekIdx; // 3 es la semana actual
            if (mappedIdx >= 0 && mappedIdx <= 3 && logsByPatientAndWeek[log.student_id]) {
              logsByPatientAndWeek[log.student_id][mappedIdx]++;
            }
          });

          for (let w = 0; w < 4; w++) {
            patientIds.forEach(id => {
              const logsCount = logsByPatientAndWeek[id][w];
              if (logsCount >= 5) {
                weeksData[w].alto++;
              } else if (logsCount >= 2) {
                weeksData[w].medio++;
              } else {
                weeksData[w].bajo++;
              }
            });
          }

          const total = patientIds.length;
          const lineAlto = weeksData.map(w => Math.round((w.alto / total) * 100));
          const lineMedio = weeksData.map(w => Math.round((w.medio / total) * 100));
          const lineBajo = weeksData.map(w => Math.round((w.bajo / total) * 100));

          this.lineChartData = {
            labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
            datasets: [
              { data: lineAlto, label: 'Apego Alto', borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, fill: false },
              { data: lineMedio, label: 'Apego Medio', borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', tension: 0.4, fill: false },
              { data: lineBajo, label: 'Apego Bajo', borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.4, fill: false }
            ]
          };
        }
      }

      // 6. Configurar Gráfico de Dona (Objetivos)
      const totalCategorized = fatLoss + muscleGain + diabetesMgmt + sportsPerf + intolerances;
      if (totalCategorized > 0) {
        this.pieChartValues = [
          Math.round((fatLoss / totalCategorized) * 100),
          Math.round((muscleGain / totalCategorized) * 100),
          Math.round((diabetesMgmt / totalCategorized) * 100),
          Math.round((sportsPerf / totalCategorized) * 100),
          Math.round((intolerances / totalCategorized) * 100)
        ];
        this.pieChartData = {
          labels: this.pieChartLabels,
          datasets: [ {
            data: this.pieChartValues,
            backgroundColor: this.pieChartColors,
            borderWidth: 0,
            hoverOffset: 4
          } ]
        };
      }

      // 7. Cargar Alertas desde Diario Emocional o bitácoras en las últimas 72 horas
      const alertsList: any[] = [];
      let alertId = 1;

      // EAT-26 alto
      myPatients.forEach((u: any) => {
        const records = u.student_clinical_records;
        const recordObj = Array.isArray(records) ? records[0] : records;
        if (recordObj?.additional_notes) {
          try {
            const dec = this.crypto.decrypt(recordObj.additional_notes);
            const parsed = JSON.parse(dec);
            if (parsed.q1) {
              const scoreObj = this.calculateEat26Score(parsed);
              if (scoreObj.hasRisk) {
                const profile = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles;
                const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Estudiante';
                alertsList.push({
                  id: alertId++,
                  level: "critical",
                  patient: name,
                  message: `EAT-26 finalizado con ${scoreObj.score} puntos (Riesgo Alto de TCA).`,
                  time: "Hace poco"
                });
              }
            }
          } catch(e) {}
        }
      });

      // Diarios alimentarios sospechosos (malestar, ayuno extremo)
      if (patientIds.length > 0) {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const { data: foodDiary } = await this.supabase
          .from('food_diary_entries')
          .select(`
            student_id,
            diary_date,
            what_i_ate,
            users!food_diary_entries_student_id_fkey (
              profiles (first_name, last_name)
            )
          `)
          .in('student_id', patientIds)
          .gte('diary_date', threeDaysAgo.toISOString().split('T')[0]);

        if (foodDiary && foodDiary.length > 0) {
          foodDiary.forEach((entry: any) => {
            let decryptedWhat = '';
            try {
              decryptedWhat = this.crypto.decrypt(entry.what_i_ate || '');
            } catch(e) {
              decryptedWhat = entry.what_i_ate || '';
            }
            const cleanWhat = decryptedWhat.toLowerCase();
            
            let alertMsg = '';
            if (cleanWhat.includes('dolor') || cleanWhat.includes('gastritis') || cleanWhat.includes('inflamado') || cleanWhat.includes('malestar')) {
              alertMsg = 'Reportó malestar estomacal en su diario de alimentación.';
            } else if (cleanWhat.includes('vómito') || cleanWhat.includes('devolví') || cleanWhat.includes('vomit')) {
              alertMsg = 'Reportó posible purga/vómito en su diario de alimentación.';
            } else if (cleanWhat.includes('ayuno') || cleanWhat.includes('no comí') || cleanWhat.includes('nada de comida')) {
              alertMsg = 'Reportó ayuno prolongado o consumo nulo.';
            }

            if (alertMsg) {
              const student = entry.users;
              const profile = student ? (Array.isArray(student.profiles) ? student.profiles[0] : student.profiles) : null;
              const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Estudiante';
              
              if (!alertsList.some(a => a.patient === name && a.message === alertMsg)) {
                alertsList.push({
                  id: alertId++,
                  level: "warning",
                  patient: name,
                  message: alertMsg,
                  time: "Reciente"
                });
              }
            }
          });
        }
      }

      // Si no hay alertas
      if (alertsList.length === 0) {
        alertsList.push({
          id: alertId++,
          level: "info",
          patient: "Sistema",
          message: "No se registran alertas de monitoreo clínico en las últimas 72 horas.",
          time: "Hoy"
        });
      }

      this.alerts = alertsList;

    } catch (err) {
      console.error('Error general cargando dashboard dinámico:', err);
    } finally {
      this.loading = false;
    }
  }
}
