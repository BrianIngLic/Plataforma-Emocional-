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
    
    // 1. Obtener usuarios psicólogos y sus correos de auth.users mediante RPC segura (Zero-Trust)
    const { data: users, error } = await supabase.rpc('get_admin_psychologists');

    if (error || !users) return [];

    // 2. Obtener la cantidad de pacientes asignados a cada psicólogo
    const { data: records } = await supabase
      .from('student_clinical_records')
      .select('primary_psychologist_id')
      .not('primary_psychologist_id', 'is', null);

    const patientsMap: Record<string, number> = {};
    if (records) {
      records.forEach(r => {
        if (r.primary_psychologist_id) {
          patientsMap[r.primary_psychologist_id] = (patientsMap[r.primary_psychologist_id] || 0) + 1;
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

      return {
        id: u.id,
        name: `Dr. ${u.first_name || ''} ${u.last_name || ''}`.trim(),
        email: u.email || 'Sin correo registrado',
        faculty: u.faculty || 'Sin asignar',
        patients: patients,
        capacity: capacity,
        attendanceRate: attendanceRate,
        sessionsCompleted: sessionsCompleted,
        sessionsScheduled: sessionsScheduled,
        evaluation: 4.0 + Number(Math.random().toFixed(1)), // MOCK: Pendiente de implementar calificaciones
        alert: alert,
        specialty: 'General',
        avgSessionDuration: 50,
        dropouts: 0
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
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        start_time,
        end_time,
        status,
        type,
        patient:users!patient_id (profiles(first_name, last_name, faculty)),
        psychologist:users!professional_id (profiles(first_name, last_name))
      `)
      .gte('start_time', startDate.toISOString())
      .lt('start_time', endDate.toISOString());

    if (error || !data) return [];

    return data.map((a: any) => {
      // Dependiendo de cómo resuelva la relación, puede venir como array o como objeto.
      // Se estandariza leyendo la propiedad profiles.
      const patientData = Array.isArray(a.patient) ? a.patient[0] : a.patient;
      const psychData = Array.isArray(a.psychologist) ? a.psychologist[0] : a.psychologist;

      const pProfile = patientData?.profiles?.[0] || patientData?.profiles;
      const psychProfile = psychData?.profiles?.[0] || psychData?.profiles;

      return {
        id: a.id,
        psychologist: `Dr. ${psychProfile?.last_name || 'Desconocido'}`,
        patient: `${pProfile?.first_name || 'Desconocido'} ${pProfile?.last_name || ''}`,
        faculty: pProfile?.faculty || 'Sin asignar',
        date: a.start_time.split('T')[0],
        startTime: new Date(a.start_time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        endTime: new Date(a.end_time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        status: a.status,
        type: a.type
      };
    });
  }
}
