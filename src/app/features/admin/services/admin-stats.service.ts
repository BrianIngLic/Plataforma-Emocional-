import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

export interface OverviewMetrics {
  activePatients: number;
  newPatientsThisMonth: number;
  psychologists: number;
  activePsychologists: number;
  sessionsToday: number;
  activeAlerts: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminStatsService {
  private supabaseService = inject(SupabaseService);

  async getOverviewMetrics(): Promise<OverviewMetrics> {
    const supabase = this.supabaseService.supabase;
    const now = new Date();
    
    // 1. Pacientes Activos
    const { count: activePatients } = await supabase
      .from('patient_settings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Nuevos este mes
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count: newPatientsThisMonth } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', 2)
      .gte('created_at', startOfMonth);

    // 2. Psicólogos
    const { count: psychologists } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', 3);

    // Psicólogos con carga activa (tienen pacientes o capacidad configurada > 0)
    // Simplificación por ahora = total
    const activePsychologists = psychologists || 0;

    // 3. Sesiones Hoy
    const todayStr = now.toISOString().split('T')[0];
    const { count: sessionsToday } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .gte('start_time', `${todayStr}T00:00:00Z`)
      .lt('start_time', `${todayStr}T23:59:59Z`)
      .not('status', 'eq', 'cancelled');

    return {
      activePatients: activePatients || 0,
      newPatientsThisMonth: newPatientsThisMonth || 0,
      psychologists: psychologists || 0,
      activePsychologists: activePsychologists,
      sessionsToday: sessionsToday || 0,
      activeAlerts: 0 // Placeholder para el futuro
    };
  }

  async getPatientsByFaculty(): Promise<ChartDataPoint[]> {
    const supabase = this.supabaseService.supabase;
    // Hacemos join manual de users -> profiles -> faculties -> campuses
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        role_id,
        profiles (faculty),
        patient_settings (status)
      `)
      .eq('role_id', 2);

    if (error || !data) return [];

    // Agrupación en JS (Supabase RPC no está disponible)
    const facultyCounts: Record<string, number> = {};
    const colors = ['#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    
    data.forEach((user: any) => {
      const ps = Array.isArray(user.patient_settings) ? user.patient_settings[0] : user.patient_settings;
      const p = Array.isArray(user.profiles) ? user.profiles[0] : user.profiles;

      const isDropout = ps && ps.status === 'dropout';
      if (!isDropout && p) {
        const fac = p.faculty || 'Desconocida';
        facultyCounts[fac] = (facultyCounts[fac] || 0) + 1;
      }
    });

    let index = 0;
    return Object.entries(facultyCounts).map(([faculty, count]) => ({
      label: faculty,
      value: count,
      color: colors[index++ % colors.length]
    })).sort((a, b) => b.value - a.value);
  }

  async getFacultiesWithStats(): Promise<any[]> {
    const supabase = this.supabaseService.supabase;
    
    // 1. Obtener facultades base
    const { data: faculties, error: facErr } = await supabase
      .from('faculties')
      .select('*, campuses(name)')
      .order('name');
      
    if (facErr || !faculties) return [];

    // 2. Obtener usuarios para contar psicólogos y pacientes
    const { data: users, error: uErr } = await supabase
      .from('users')
      .select(`
        id, role_id, 
        profiles(faculty),
        health_professional_settings(capacity)
      `);

    const result = faculties.map(f => {
      let cap = 0;
      let pats = 0;
      let psychs = 0;

      if (users) {
        users.forEach(u => {
          const prof = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles;
          const profileFac = prof ? prof.faculty : null;
          if (profileFac === f.name) {
            if (u.role_id === 3) {
              psychs++;
              const sett = Array.isArray(u.health_professional_settings) ? u.health_professional_settings[0] : u.health_professional_settings;
              if (sett) {
                cap += sett.capacity || 0;
              }
            } else if (u.role_id === 2) {
              pats++;
            }
          }
        });
      }

      // Evitar división por cero
      if (cap === 0) cap = 1;

      const pct = pats / cap;
      let demand = 'Low';
      if(pct > 0.85) demand = 'Critical';
      else if(pct > 0.65) demand = 'High';
      else if(pct > 0.40) demand = 'Moderate';

      return {
        id: String(f.id),
        name: f.name,
        campus_name: f.campuses?.name || 'Desconocido',
        patients: pats,
        capacity: cap === 1 && psychs === 0 ? 0 : cap, // Si no hay psicólogos la cap real es 0
        psychologists: psychs,
        demand: demand,
        risk: pct > 0.8 ? 'High' : 'Low',
        avgSessionsWeek: pats * 0.8, // Estimación basada en activos
        dropoutRate: 0,
        newThisMonth: 0,
        topDiagnosis: 'Por determinar'
      };
    });

    return result;
  }

  async getPsychologistsWithStats(): Promise<any[]> {
    const supabase = this.supabaseService.supabase;
    
    // 1. Obtener usuarios psicólogos y nutriólogos y sus correos de auth.users mediante RPC segura (Zero-Trust)
    let { data: users, error } = await supabase.rpc('get_admin_health_professionals');

    if (error || !users) {
      console.warn('⚠️ RPC get_admin_health_professionals no disponible (404/Error). Activando fallback transparente a tablas users, profiles y health_professional_settings...');
      const { data: fallbackUsers, error: fbErr } = await supabase
        .from('users')
        .select(`
          id, role_id, matricula, mobile_phone,
          profiles (first_name, last_name, faculty, avatar_url),
          health_professional_settings (capacity, location, modality)
        `)
        .in('role_id', [3, 4]);

      if (fbErr || !fallbackUsers) {
        console.error('❌ Error en fallback de getPsychologistsWithStats:', fbErr);
        return [];
      }

      users = fallbackUsers.map((u: any) => {
        const p = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles;
        const h = Array.isArray(u.health_professional_settings) ? u.health_professional_settings[0] : u.health_professional_settings;
        return {
          id: u.id,
          role_id: u.role_id,
          matricula: u.matricula || '',
          first_name: p?.first_name || '',
          last_name: p?.last_name || '',
          email: `${u.matricula || u.id.slice(0, 8)}@ep.buap.mx`, // fallback email
          faculty: p?.faculty || '',
          celular: u.mobile_phone || '',
          capacity: h?.capacity || 40,
          location: h?.location || 'Consultorio Virtual',
          modality: h?.modality || 'virtual',
          avatar_url: p?.avatar_url || ''
        };
      });
    }

    if (!users) return [];

    // 2. Obtener la cantidad de pacientes asignados a cada profesional
    const { data: records } = await supabase
      .from('student_clinical_records')
      .select('primary_psychologist_id, primary_nutritionist_id');

    const patientsMap: Record<string, number> = {};
    if (records) {
      records.forEach(r => {
        if (r.primary_psychologist_id) {
          patientsMap[r.primary_psychologist_id] = (patientsMap[r.primary_psychologist_id] || 0) + 1;
        }
        if (r.primary_nutritionist_id) {
          patientsMap[r.primary_nutritionist_id] = (patientsMap[r.primary_nutritionist_id] || 0) + 1;
        }
      });
    }

    // 3. Obtener citas para calcular sesiones y asistencia
    const { data: appointments } = await supabase
      .from('appointments')
      .select('professional_id, status')
      .not('professional_id', 'is', null);

    const apptMap: Record<string, { scheduled: number; completed: number; canceled: number; total: number }> = {};
    if (appointments) {
      appointments.forEach(a => {
        if (a.professional_id) {
          if (!apptMap[a.professional_id]) {
            apptMap[a.professional_id] = { scheduled: 0, completed: 0, canceled: 0, total: 0 };
          }
          apptMap[a.professional_id].total += 1;
          if (a.status === 'scheduled') apptMap[a.professional_id].scheduled += 1;
          if (a.status === 'completed') apptMap[a.professional_id].completed += 1;
          if (a.status === 'canceled') apptMap[a.professional_id].canceled += 1;
        }
      });
    }

    // 4. Obtener calificaciones promedio reales
    const { data: evals } = await supabase
      .from('session_evaluations')
      .select('professional_id, score_global');

    const evalsMap: Record<string, { sum: number; count: number }> = {};
    if (evals) {
      evals.forEach(e => {
        if (e.professional_id) {
          if (!evalsMap[e.professional_id]) {
            evalsMap[e.professional_id] = { sum: 0, count: 0 };
          }
          evalsMap[e.professional_id].sum += Number(e.score_global);
          evalsMap[e.professional_id].count += 1;
        }
      });
    }

    return users.map((u: any) => {
      const capacity = u.capacity || 40;
      const patients = patientsMap[u.id] || 0;
      const pct = patients / capacity;

      let alert = 'none';
      if (pct > 0.85) alert = 'overload';
      else if (pct < 0.3) alert = 'few-patients';

      const stats = apptMap[u.id] || { scheduled: 0, completed: 0, canceled: 0, total: 0 };
      
      // Sesiones históricas que determinan eficiencia y asistencia
      const pastSessions = stats.completed + stats.canceled;
      const attendanceRate = pastSessions > 0 ? Math.round((stats.completed / pastSessions) * 100) : 100;
      
      // Evitar división por cero en el frontend para calcular "Eficiencia"
      const sessionsScheduled = pastSessions > 0 ? pastSessions : 1;
      const sessionsCompleted = pastSessions > 0 ? stats.completed : 1;

      // Calcular promedio real o usar 5.0 por defecto
      const evalInfo = evalsMap[u.id];
      const avgEval = evalInfo ? Math.round((evalInfo.sum / evalInfo.count) * 10) / 10 : 5.0;

      return {
        id: u.id,
        role_id: u.role_id,
        role_name: u.role_id === 4 ? 'Nutriólogo' : 'Psicólogo',
        name: `Dr. ${u.first_name || ''} ${u.last_name || ''}`.trim(),
        email: u.email || 'Sin correo registrado',
        faculty: u.faculty || 'Sin asignar',
        patients: patients,
        capacity: capacity,
        attendanceRate: attendanceRate,
        sessionsCompleted: sessionsCompleted,
        sessionsScheduled: sessionsScheduled,
        evaluation: avgEval,
        alert: alert,
        specialty: u.role_id === 4 ? 'Nutrición Clínica' : 'Psicología General',
        avgSessionDuration: 50,
        dropouts: 0,
        avatar_url: u.avatar_url || ''
      };
    });
  }

  async getPatientStats() {
    const supabase = this.supabaseService.supabase;
    
    // Obtener todos los pacientes
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id, 
        created_at,
        profiles(faculty),
        patient_settings(status, self_diagnosis)
      `)
      .eq('role_id', 2);

    if (error || !users) return null;

    // 1. By Faculty (Active, Dropout, Discharged)
    const facultyMap: any = {};
    const diagnosisMap: any = {};
    const growthMap: any = {};

    users.forEach(u => {
      const p = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles;
      const ps = Array.isArray(u.patient_settings) ? u.patient_settings[0] : u.patient_settings;

      const fac = p && p.faculty ? p.faculty : 'Desconocida';
      const status = ps && ps.status ? ps.status : 'active';
      const diag = ps && ps.self_diagnosis ? ps.self_diagnosis : 'Sin especificar';
      
      // Faculty Stats
      if (!facultyMap[fac]) facultyMap[fac] = { active: 0, dropout: 0, discharged: 0 };
      if (status === 'active') facultyMap[fac].active++;
      else if (status === 'dropout') facultyMap[fac].dropout++;
      else if (status === 'discharged') facultyMap[fac].discharged++;

      // Diagnosis Stats
      if (!diagnosisMap[diag]) diagnosisMap[diag] = 0;
      diagnosisMap[diag]++;

      // Growth Trend (Mocking historical based on created_at and dropout, just counting recent ones by month)
      const date = new Date(u.created_at);
      const month = date.toLocaleString('en-US', { month: 'short' });
      if (!growthMap[month]) growthMap[month] = { newPatients: 0, dropouts: 0 };
      
      growthMap[month].newPatients++;
      if (status === 'dropout') {
        growthMap[month].dropouts++;
      }
    });

    const colors = ['#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    let cIdx = 0;

    const byFaculty = Object.keys(facultyMap).map(k => ({
      faculty: k,
      active: facultyMap[k].active,
      dropout: facultyMap[k].dropout,
      discharged: facultyMap[k].discharged,
      color: colors[cIdx++ % colors.length]
    }));

    cIdx = 0;
    const diagnosisDistribution = Object.keys(diagnosisMap).map(k => ({
      name: k,
      value: diagnosisMap[k],
      color: colors[cIdx++ % colors.length]
    })).sort((a,b) => b.value - a.value);

    // Sort months chronologically roughly or just use existing keys
    const growthTrend = Object.keys(growthMap).map(k => ({
      month: k,
      newPatients: growthMap[k].newPatients,
      dropouts: growthMap[k].dropouts,
      net: growthMap[k].newPatients - growthMap[k].dropouts
    }));

    // Si la BD está vacía, retornar valores por defecto para que las gráficas no exploten
    if (byFaculty.length === 0) {
      byFaculty.push({ faculty: 'Ingeniería', active: 0, dropout: 0, discharged: 0, color: '#3b82f6' });
    }
    if (diagnosisDistribution.length === 0) {
      diagnosisDistribution.push({ name: 'Sin datos', value: 1, color: '#94a3b8' });
    }
    if (growthTrend.length === 0) {
      growthTrend.push({ month: new Date().toLocaleString('en-US', {month: 'short'}), newPatients: 0, dropouts: 0, net: 0 });
    }

    return { byFaculty, diagnosisDistribution, growthTrend };
  }

  async getAgendaAppointments(startDate: Date, endDate: Date) {
    const supabase = this.supabaseService.supabase;
    try {
      // 1. Consultar citas filtrando por la columna de fecha correcta: scheduled_date
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('id, student_id, professional_id, scheduled_date, start_time, end_time, status, notes')
        .gte('scheduled_date', startDate.toISOString())
        .lte('scheduled_date', endDate.toISOString());

      if (error) throw error;
      if (!appointments || appointments.length === 0) return [];

      // 2. Resolver los perfiles de estudiantes y profesionales involucrados para evitar JOINS complejos propensos a 400
      const studentIds = appointments.map(a => a.student_id).filter(Boolean);
      const professionalIds = appointments.map(a => a.professional_id).filter(Boolean);

      const [studentsRes, professionalsRes] = await Promise.all([
        supabase.from('users').select('id, profiles(first_name, last_name, faculty)').in('id', studentIds),
        supabase.from('users').select('id, profiles(first_name, last_name)').in('id', professionalIds)
      ]);

      const studentsMap = new Map<string, any>();
      if (studentsRes.data) {
        studentsRes.data.forEach((s: any) => {
          const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
          studentsMap.set(s.id, profile);
        });
      }

      const professionalsMap = new Map<string, any>();
      if (professionalsRes.data) {
        professionalsRes.data.forEach((p: any) => {
          const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
          professionalsMap.set(p.id, profile);
        });
      }

      return appointments.map((a: any) => {
        const studentProfile = studentsMap.get(a.student_id);
        const psychProfile = professionalsMap.get(a.professional_id);

        const dateStr = a.scheduled_date ? String(a.scheduled_date).split('T')[0] : '';
        const startTimeStr = a.start_time ? String(a.start_time).substring(0, 5) : '08:00';
        const endTimeStr = a.end_time ? String(a.end_time).substring(0, 5) : '09:00';

        return {
          id: a.id,
          psychologist: psychProfile ? `Dr. ${psychProfile.last_name || 'Desconocido'}` : 'Dr. Desconocido',
          patient: studentProfile ? `${studentProfile.first_name || 'Desconocido'} ${studentProfile.last_name || ''}`.trim() : 'Estudiante Desconocido',
          faculty: studentProfile?.faculty || 'Sin asignar',
          date: dateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          status: a.status,
          notes: a.notes,
          type: 'virtual' // Default fallback dado que la BD no tiene columna type
        };
      });
    } catch (err) {
      console.error('Error in getAgendaAppointments:', err);
      return [];
    }
  }

  async getReportsData(): Promise<{ facultyReport: any[], psychReport: any[], periodReport: any[] }> {
    const supabase = this.supabaseService.supabase;
    const colors = ['#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    try {
      // 1. Obtener todas las citas
      const { data: appointments, error: apptErr } = await supabase
        .from('appointments')
        .select('id, student_id, professional_id, scheduled_date, start_time, end_time, status');

      if (apptErr) throw apptErr;

      // 2. Obtener usuarios, perfiles, estados de pacientes/especialistas y evaluaciones en paralelo
      const [usersRes, profilesRes, patientSettingsRes, evaluationsRes] = await Promise.all([
        supabase.from('users').select('id, role_id, created_at'),
        supabase.from('profiles').select('user_id, first_name, last_name, faculty'),
        supabase.from('patient_settings').select('patient_id, status, created_at'),
        supabase.from('session_evaluations').select('appointment_id, score_global')
      ]);

      if (usersRes.error) throw usersRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (patientSettingsRes.error) throw patientSettingsRes.error;
      if (evaluationsRes.error) throw evaluationsRes.error;

      const profilesMap = new Map<string, any>();
      if (profilesRes.data) {
        profilesRes.data.forEach((p: any) => {
          profilesMap.set(p.user_id, p);
        });
      }

      const settingsMap = new Map<string, any>();
      if (patientSettingsRes.data) {
        patientSettingsRes.data.forEach((s: any) => {
          settingsMap.set(s.patient_id, s);
        });
      }

      // Mapear evaluaciones por id de cita para búsqueda rápida
      const evalsMap = new Map<string, number>();
      if (evaluationsRes.data) {
        evaluationsRes.data.forEach((ev: any) => {
          evalsMap.set(ev.appointment_id, Number(ev.score_global));
        });
      }

      // Mapear usuarios por id
      const usersMap = new Map<string, any>();
      if (usersRes.data) {
        usersRes.data.forEach((u: any) => {
          const profile = profilesMap.get(u.id);
          const settings = settingsMap.get(u.id);
          usersMap.set(u.id, {
            id: u.id,
            role_id: u.role_id,
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
            faculty: profile?.faculty || 'Sin asignar',
            status: settings?.status || 'active',
            status_updated_at: settings?.created_at || u.created_at || null
          });
        });
      }

      // --- 1. PROCESAR REPORTE POR FACULTAD ---
      const facultyMap: Record<string, { sessions: number, patients: Set<string>, dropout: number, totalDuration: number, completedCount: number }> = {};

      // Primero inicializar todas las facultades en base a los estudiantes registrados
      usersMap.forEach((user) => {
        if (user.role_id === 2) { // Estudiante
          const fac = user.faculty;
          if (!facultyMap[fac]) {
            facultyMap[fac] = { sessions: 0, patients: new Set(), dropout: 0, totalDuration: 0, completedCount: 0 };
          }
          facultyMap[fac].patients.add(user.id);
          if (user.status === 'dropout') {
            facultyMap[fac].dropout++;
          }
        }
      });

      // Luego procesar citas para facultades
      if (appointments) {
        appointments.forEach((appt: any) => {
          const student = usersMap.get(appt.student_id);
          if (student && student.role_id === 2) {
            const fac = student.faculty;
            if (!facultyMap[fac]) {
              facultyMap[fac] = { sessions: 0, patients: new Set(), dropout: 0, totalDuration: 0, completedCount: 0 };
            }
            facultyMap[fac].patients.add(appt.student_id);
            if (appt.status === 'completed') {
              facultyMap[fac].sessions++;
              
              // Calcular duración (ponytail: simplificado con valores fallback si no hay datos)
              let duration = 50;
              if (appt.start_time && appt.end_time) {
                const [sh, sm] = appt.start_time.split(':').map(Number);
                const [eh, em] = appt.end_time.split(':').map(Number);
                const diffMin = (eh * 60 + em) - (sh * 60 + sm);
                if (diffMin > 0) duration = diffMin;
              }
              facultyMap[fac].totalDuration += duration;
              facultyMap[fac].completedCount++;
            }
          }
        });
      }

      let fIdx = 0;
      const facultyReport = Object.entries(facultyMap).map(([facultyName, data]) => ({
        faculty: facultyName,
        sessions: data.sessions,
        patients: data.patients.size,
        dropout: data.dropout,
        avg: data.completedCount > 0 ? Math.round(data.totalDuration / data.completedCount) : 50,
        color: colors[fIdx++ % colors.length]
      })).sort((a, b) => b.sessions - a.sessions);


      // --- 2. PROCESAR REPORTE POR PSICÓLOGO ---
      const psychMap: Record<string, { name: string, sessions: number, patients: Set<string>, completed: number, cancelled: number, total: number }> = {};

      // Inicializar profesionales (Psicólogos role_id = 3 y Nutriólogos role_id = 4)
      usersMap.forEach((user) => {
        if (user.role_id === 3 || user.role_id === 4) {
          const name = `Dr. ${user.first_name} ${user.last_name}`.trim();
          psychMap[user.id] = { name, sessions: 0, patients: new Set(), completed: 0, cancelled: 0, total: 0 };
        }
      });

      // Obtener asignación de pacientes a profesionales para contar pacientes activos
      const { data: clinicalRecords } = await supabase
        .from('student_clinical_records')
        .select('student_id, primary_psychologist_id, primary_nutritionist_id');

      if (clinicalRecords) {
        clinicalRecords.forEach((record: any) => {
          if (record.primary_psychologist_id && psychMap[record.primary_psychologist_id]) {
            psychMap[record.primary_psychologist_id].patients.add(record.student_id);
          }
          if (record.primary_nutritionist_id && psychMap[record.primary_nutritionist_id]) {
            psychMap[record.primary_nutritionist_id].patients.add(record.student_id);
          }
        });
      }

      // Procesar citas por profesional
      if (appointments) {
        appointments.forEach((appt: any) => {
          const profId = appt.professional_id;
          if (profId && psychMap[profId]) {
            psychMap[profId].total++;
            if (appt.status === 'completed') {
              psychMap[profId].completed++;
              psychMap[profId].sessions++;
            } else if (appt.status === 'cancelled' || appt.status === 'canceled') {
              psychMap[profId].cancelled++;
            }
          }
        });
      }

      const psychReport = Object.entries(psychMap).map(([id, data]) => {
        const totalPast = data.completed + data.cancelled;
        const attendance = totalPast > 0 ? Math.round((data.completed / totalPast) * 100) : 100;
        const efficiency = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 100;
        
        return {
          name: data.name,
          sessions: data.sessions,
          patients: data.patients.size,
          attendance,
          efficiency
        };
      }).sort((a, b) => b.sessions - a.sessions);


      // --- 3. PROCESAR REPORTE POR PERÍODO ---
      const periodMap: Record<string, { monthName: string, sessions: number, newPatients: number, dropouts: number, totalScore: number, scoreCount: number }> = {};
      const spanishMonths = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      
      // Generar los últimos 6 meses
      const today = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthName = spanishMonths[d.getMonth()];
        periodMap[key] = { monthName, sessions: 0, newPatients: 0, dropouts: 0, totalScore: 0, scoreCount: 0 };
      }

      // Agrupar citas por período
      if (appointments) {
        appointments.forEach((appt: any) => {
          if (appt.status === 'completed' && appt.scheduled_date) {
            const d = new Date(appt.scheduled_date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (periodMap[key]) {
              periodMap[key].sessions++;
              
              const score = evalsMap.get(appt.id);
              if (score !== undefined && score !== null) {
                periodMap[key].totalScore += score;
                periodMap[key].scoreCount++;
              }
            }
          }
        });
      }

      // Agrupar nuevos ingresos por período
      if (usersRes.data) {
        usersRes.data.forEach((u: any) => {
          if (u.role_id === 2 && u.created_at) {
            const d = new Date(u.created_at);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (periodMap[key]) {
              periodMap[key].newPatients++;
            }
          }
        });
      }

      // Agrupar deserciones (dropouts) por período
      usersMap.forEach((user) => {
        if (user.role_id === 2 && user.status === 'dropout' && user.status_updated_at) {
          const d = new Date(user.status_updated_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (periodMap[key]) {
            periodMap[key].dropouts++;
          }
        }
      });

      const periodReport = Object.entries(periodMap).map(([key, data]) => {
        const rawAvgScore = data.scoreCount > 0 ? (data.totalScore / data.scoreCount) : 0;
        const avgScore = Number((rawAvgScore * 2).toFixed(1));
        
        return {
          month: data.monthName,
          sessions: data.sessions,
          new: data.newPatients,
          dropouts: data.dropouts,
          avgScore: avgScore
        };
      });

      return { facultyReport, psychReport, periodReport };

    } catch (err) {
      console.error('Error generando getReportsData:', err);
      return { facultyReport: [], psychReport: [], periodReport: [] };
    }
  }
}

