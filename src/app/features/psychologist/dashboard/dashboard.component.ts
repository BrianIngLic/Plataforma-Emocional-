import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { CryptoService } from '../../../core/services/crypto.service';

@Component({
  selector: 'app-psychologist-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class PsychologistDashboardComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);
  private cryptoService = inject(CryptoService);

  // Stats variables
  totalPatients = 0;
  newPatientsThisMonth = 0;
  violenceRiskCount = 0;
  violencePercentage = 0;
  avgSleepHours = 0;
  highRiskCount = 0;
  urgentAlertsCount = 0;
  nextSessionText = 'Sin sesiones hoy';

  emergencyCases: any[] = [];
  agenda: any[] = [];
  alerts: any[] = [];

  // ponytail: Simple Chart.js configuration structures mapped directly to view
  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    datasets: [
      { data: [0, 0, 0, 0, 0, 0, 0], label: 'Horas de Sueño', borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', tension: 0.4, fill: true }
    ]
  };

  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } } }
  };

  public pieChartLabels: string[] = [];
  public pieChartValues: number[] = [];
  public pieChartColors = [ '#10b981', '#1a56db', '#0ea5e9', '#94a3b8', '#f59e0b', '#ef4444', '#b91c1c', '#6b7280' ];

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

  async ngOnInit() {
    await this.loadDashboardData();
  }

  // ponytail: Minimum necessary query logic to resolve all dynamic values in a single flow
  async loadDashboardData() {
    const profId = this.authService.currentUser()?.id;
    if (!profId) return;

    // 1. Fetch assigned patients
    const { data: clinicalRecords, error: recordsError } = await this.supabaseService.supabase
      .from('student_clinical_records')
      .select('student_id, additional_notes')
      .eq('primary_psychologist_id', profId);

    if (recordsError || !clinicalRecords) {
      this.totalPatients = 0;
      this.updateChartsWithNoData();
      return;
    }

    this.totalPatients = clinicalRecords.length;
    const studentIds = clinicalRecords.map(r => r.student_id);

    if (studentIds.length === 0) {
      this.updateChartsWithNoData();
      return;
    }

    // 2. Fetch profiles of these patients
    const { data: studentProfiles } = await this.supabaseService.supabase
      .from('profiles')
      .select('user_id, first_name, last_name, avatar_url, created_at')
      .in('user_id', studentIds);

    const profileMap = new Map<string, any>();
    studentProfiles?.forEach(p => {
      profileMap.set(p.user_id, p);
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    this.newPatientsThisMonth = studentProfiles?.filter(p => p.created_at && new Date(p.created_at) >= thirtyDaysAgo).length || 0;

    // 3. Calculate violence risk statistics
    let violenceCount = 0;
    const violenceStats = { edad: 0, genero: 0, discapacidad: 0, condicion_socioeconomica: 0, origen_etnico: 0 };
    
    clinicalRecords.forEach(rec => {
      if (rec.additional_notes) {
        try {
          const decrypted = this.cryptoService.decrypt(rec.additional_notes);
          const parsed = JSON.parse(decrypted);
          const vv = parsed.vulnerabilidad_violencia || {};
          let hasAnyViolence = false;
          Object.keys(vv).forEach(period => {
            const periodData = vv[period];
            if (periodData) {
              if (periodData.edad) { violenceStats.edad++; hasAnyViolence = true; }
              if (periodData.genero) { violenceStats.genero++; hasAnyViolence = true; }
              if (periodData.discapacidad) { violenceStats.discapacidad++; hasAnyViolence = true; }
              if (periodData.condicion_socioeconomica) { violenceStats.condicion_socioeconomica++; hasAnyViolence = true; }
              if (periodData.origen_etnico) { violenceStats.origen_etnico++; hasAnyViolence = true; }
            }
          });
          if (hasAnyViolence) {
            violenceCount++;
          }
        } catch (e) {
          // Ignore decryption/parse errors
        }
      }
    });
    this.violenceRiskCount = violenceCount;
    this.violencePercentage = (violenceCount / this.totalPatients) * 100;

    // 4. Fetch today's appointments
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data: appointments } = await this.supabaseService.supabase
      .from('appointments')
      .select('id, scheduled_date, status, student_id, priority_level')
      .eq('professional_id', profId)
      .gte('scheduled_date', todayStart.toISOString())
      .lte('scheduled_date', todayEnd.toISOString())
      .order('scheduled_date', { ascending: true });

    const todaySessions = appointments || [];
    this.agenda = todaySessions.map(appt => {
      const timeObj = new Date(appt.scheduled_date);
      const timeStr = timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const profile = profileMap.get(appt.student_id);
      const patientName = profile ? `${profile.first_name} ${profile.last_name}` : 'Estudiante';
      return {
        time: timeStr,
        patient: patientName,
        type: appt.priority_level === 'Emergency' ? 'Intervención Crisis' : 'Seguimiento',
        duration: 50,
        status: appt.status === 'scheduled' ? 'pending' : (appt.status === 'completed' ? 'confirmed' : 'urgent')
      };
    });

    const nextScheduledSession = todaySessions.find(s => s.status === 'scheduled');
    if (nextScheduledSession) {
      const nextTime = new Date(nextScheduledSession.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const nextProfile = profileMap.get(nextScheduledSession.student_id);
      const nextName = nextProfile ? `${nextProfile.first_name} ${nextProfile.last_name.substring(0, 1)}.` : 'Estudiante';
      this.nextSessionText = `Siguiente: ${nextName} ${nextTime}`;
    } else {
      this.nextSessionText = todaySessions.length > 0 ? 'Sesiones del día completadas' : 'Día libre';
    }

    // 5. Fetch diary entries for sleep and emotions (last 30 days)
    const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();
    const { data: diaryEntries } = await this.supabaseService.supabase
      .from('diary_entries')
      .select('id, student_id, moods, sleep_hours, high_risk, created_at')
      .in('student_id', studentIds)
      .gte('created_at', thirtyDaysAgoIso)
      .order('created_at', { ascending: false });

    const entries = diaryEntries || [];

    // Calculate sleep average
    const sleepEntries = entries.filter(e => e.sleep_hours !== null && e.sleep_hours !== undefined);
    if (sleepEntries.length > 0) {
      const totalSleep = sleepEntries.reduce((sum, e) => sum + Number(e.sleep_hours), 0);
      this.avgSleepHours = totalSleep / sleepEntries.length;
    } else {
      this.avgSleepHours = 0;
    }

    // Calculate high risk cases
    const highRiskStudents = new Set(entries.filter(e => e.high_risk).map(e => e.student_id));
    this.highRiskCount = highRiskStudents.size;

    const recentHighRiskEntries: any[] = [];
    const processedStudents = new Set<string>();
    entries.forEach(e => {
      if (e.high_risk && !processedStudents.has(e.student_id)) {
        processedStudents.add(e.student_id);
        const profile = profileMap.get(e.student_id);
        const patientName = profile ? `${profile.first_name} ${profile.last_name}` : 'Estudiante';
        const dateObj = new Date(e.created_at);
        const lastContact = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        recentHighRiskEntries.push({
          patient: patientName,
          risk: 'HIGH',
          diagnosis: e.moods?.join(', ') || 'Alerta emocional',
          lastContact: lastContact,
          flag: 'red'
        });
      }
    });
    this.emergencyCases = recentHighRiskEntries.slice(0, 4);

    // Calculate alerts list
    const alertList: any[] = [];
    entries.forEach(e => {
      if (e.high_risk) {
        const profile = profileMap.get(e.student_id);
        const patientName = profile ? `${profile.first_name} ${profile.last_name}` : 'Estudiante';
        const timeStr = new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        alertList.push({
          id: e.id,
          level: 'critical',
          patient: patientName,
          message: 'Ideación de autolesión o palabras de alto riesgo detectadas en el diario.',
          time: timeStr
        });
      }
    });
    this.alerts = alertList.slice(0, 4);
    this.urgentAlertsCount = alertList.filter(a => a.level === 'critical').length;

    // 6. Update Mood Distribution Chart (Doughnut Chart)
    const moodCounts: { [key: string]: number } = {};
    let totalMoodsCount = 0;
    entries.forEach(e => {
      if (e.moods) {
        e.moods.forEach((m: string) => {
          const parts = m.split(' ');
          const label = parts.length > 1 ? parts.slice(1).join(' ') : m;
          moodCounts[label] = (moodCounts[label] || 0) + 1;
          totalMoodsCount++;
        });
      }
    });

    const availableLabels = ["Excelente", "Bien", "Tranquilo", "Regular", "Ansioso", "Triste", "Enojado", "Abrumado"];
    const chartValues = availableLabels.map(label => {
      const count = moodCounts[label] || 0;
      return totalMoodsCount > 0 ? Math.round((count / totalMoodsCount) * 100) : 0;
    });

    this.pieChartLabels = availableLabels;
    this.pieChartValues = chartValues;
    this.pieChartData = {
      labels: this.pieChartLabels,
      datasets: [ {
        data: this.pieChartValues,
        backgroundColor: this.pieChartColors,
        borderWidth: 0,
        hoverOffset: 4
      } ]
    };

    // 7. Update Sleep Evolution Chart (Line Chart) - Last 7 Days
    const last7DaysLabels: string[] = [];
    const last7DaysSleepAvg: number[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString([], { day: '2-digit', month: 'short' });
      last7DaysLabels.push(label);

      const dayStart = new Date(d);
      dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23,59,59,999);

      const daySleepEntries = entries.filter(e => {
        const entryDate = new Date(e.created_at);
        return entryDate >= dayStart && entryDate <= dayEnd && e.sleep_hours !== null && e.sleep_hours !== undefined;
      });

      if (daySleepEntries.length > 0) {
        const sum = daySleepEntries.reduce((acc, e) => acc + Number(e.sleep_hours), 0);
        last7DaysSleepAvg.push(Number((sum / daySleepEntries.length).toFixed(1)));
      } else {
        last7DaysSleepAvg.push(0);
      }
    }

    this.lineChartData = {
      labels: last7DaysLabels,
      datasets: [
        {
          data: last7DaysSleepAvg,
          label: 'Horas de Sueño Promedio',
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    };
  }

  // ponytail: Fallback configuration when no data exists
  updateChartsWithNoData() {
    this.lineChartData = {
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      datasets: [
        { data: [0, 0, 0, 0, 0, 0, 0], label: 'Sin registros', borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', tension: 0.4, fill: false }
      ]
    };
    this.pieChartLabels = ['Sin datos'];
    this.pieChartValues = [100];
    this.pieChartData = {
      labels: this.pieChartLabels,
      datasets: [ { data: this.pieChartValues, backgroundColor: ['#94a3b8'], borderWidth: 0 } ]
    };
  }
}

