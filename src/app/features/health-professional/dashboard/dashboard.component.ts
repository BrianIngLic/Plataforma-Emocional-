import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-health-professional-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class HealthProfessionalDashboardComponent implements OnInit {
  authService = inject(AuthService);
  supabase = inject(SupabaseService).supabase;
  
  realAlerts: any[] = [];

  get isNutritionist(): boolean {
    return this.authService.currentUser()?.role === 'Nutricionista';
  }

  get professionalTitle(): string {
    return this.isNutritionist ? 'Nutricionista' : 'Psicólogo';
  }

  // Casos Críticos (Dinámicos según rol)
  get emergencyCases() {
    if (this.isNutritionist) {
      return [
        { patient: "Ana Lucía Gómez", risk: "HIGH", diagnosis: "Riesgo Alto TCA (EAT-26: 34)", lastContact: "Hoy 09:15", flag: "red" },
        { patient: "Juan Pablo Pérez", risk: "HIGH", diagnosis: "Alergia Severa a Celíacos + Pérdida Peso", lastContact: "Ayer", flag: "red" },
        { patient: "Mariana Rodríguez", risk: "MODERATE", diagnosis: "Diabetes Tipo 1 - Descontrol Glucémico", lastContact: "Hace 2 días", flag: "amber" },
        { patient: "Carlos Alberto Sánchez", risk: "MODERATE", diagnosis: "Vegano - Sospecha de Déficit B12", lastContact: "Hace 4 días", flag: "amber" }
      ];
    }
    return [
      { patient: "Sara Lindqvist", risk: "HIGH", diagnosis: "MDD + SI", lastContact: "Hoy 08:30", flag: "red" },
      { patient: "Yusuf Al-Amin", risk: "HIGH", diagnosis: "Bipolar I – Manic", lastContact: "Ayer", flag: "red" },
      { patient: "Carla Dominguez", risk: "MODERATE", diagnosis: "PTSD – acute", lastContact: "Hace 3 días", flag: "amber" },
      { patient: "Lena Braun", risk: "MODERATE", diagnosis: "MDD – worsening", lastContact: "Ayer", flag: "amber" }
    ];
  }

  // Agenda (Dinámica según rol)
  get agenda() {
    if (this.isNutritionist) {
      return [
        { time: "08:30", patient: "Sofía Martínez", type: "Evaluación Inicial", duration: 45, status: "confirmed" },
        { time: "09:30", patient: "Eduardo Mendoza", type: "Entrega de Menú & Bioimpedancia", duration: 30, status: "confirmed" },
        { time: "10:30", patient: "Ana Lucía Gómez", type: "Sesión Interdisciplinaria", duration: 45, status: "urgent" },
        { time: "12:00", patient: "Daniela Rivas", type: "Control / Ajuste Macronutrientes", duration: 30, status: "confirmed" },
        { time: "15:30", patient: "Roberto Castillo", type: "Nutrición Deportiva", duration: 45, status: "pending" },
        { time: "16:30", patient: "Gabriela Torres", type: "Control Mensual", duration: 30, status: "confirmed" }
      ];
    }
    return [
      { time: "09:00", patient: "Elena Marchetti", type: "Seguimiento", duration: 50, status: "confirmed" },
      { time: "10:00", patient: "David Okafor", type: "Evaluación Inicial", duration: 60, status: "confirmed" },
      { time: "11:15", patient: "Sara Lindqvist", type: "Intervención Crisis", duration: 45, status: "urgent" },
      { time: "13:30", patient: "Tomás Ruiz", type: "Seguimiento", duration: 50, status: "confirmed" },
      { time: "15:00", patient: "Amina Hassan", type: "Terapia de Grupo", duration: 90, status: "confirmed" },
      { time: "17:00", patient: "Kenji Watanabe", type: "Teleterapia", duration: 50, status: "pending" }
    ];
  }

  // Alertas (Dinámicas según rol)
  get alerts() {
    const staticAlerts = this.isNutritionist ? [
      { id: 101, level: "critical", patient: "Ana Lucía Gómez", message: "EAT-26 finalizado con 34 puntos (Riesgo Alto de TCA).", time: "Hace 1h" },
      { id: 102, level: "warning", patient: "Mateo Silva", message: "Registró déficit calórico extremo en recordatorio de 24h (< 1000 kcal).", time: "Ayer" },
      { id: 103, level: "warning", patient: "Sofía Martínez", message: "Reportó malestar estomacal agudo en su diario de alimentación.", time: "Ayer" }
    ] : [
      { id: 101, level: "critical", patient: "Sara Lindqvist", message: "Ideación de autolesión detectada por Amati en el diario.", time: "08:42" },
      { id: 102, level: "warning", patient: "Marco Ferretti", message: "Faltó a 3 citas seguidas. Sin respuesta.", time: "Ayer" },
      { id: 103, level: "warning", patient: "Lena Braun", message: "Su puntuación PHQ-9 aumentó 8 puntos.", time: "Ayer" }
    ];

    return [...this.realAlerts, ...staticAlerts];
  }

  async loadNotifications() {
    const user = this.authService.currentUser();
    if (!user) return;

    try {
      const { data, error } = await this.supabase
        .from('professional_notifications')
        .select('id, message, created_at, student_id')
        .eq('professional_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Mapear cada notificación
        const mapped = [];
        for (const n of data) {
          // Obtener el perfil del estudiante de forma separada
          const { data: prof } = await this.supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', n.student_id)
            .maybeSingle();

          const patientName = prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() : 'Paciente';
          
          mapped.push({
            id: n.id,
            level: 'info',
            patient: patientName,
            message: n.message,
            time: this.formatTimeAgo(n.created_at),
            isRealDb: true
          });
        }
        this.realAlerts = mapped;
      }
    } catch (e) {
      console.warn('Error loading professional notifications:', e);
    }
  }

  formatTimeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `Hace ${diffHrs}h`;
    return date.toLocaleDateString();
  }

  async markAllAlertsRead() {
    const user = this.authService.currentUser();
    if (!user) return;

    try {
      await this.supabase
        .from('professional_notifications')
        .update({ is_read: true })
        .eq('professional_id', user.id)
        .eq('is_read', false);

      this.realAlerts = [];
    } catch (e) {
      console.warn('Error marking alerts as read:', e);
    }
  }

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'],
    datasets: [
      { data: [38, 41, 35, 44, 50, 47, 53], label: 'Mejora', borderColor: '#1a56db', backgroundColor: 'rgba(26, 86, 219, 0.1)', tension: 0.4, fill: false },
      { data: [22, 19, 25, 21, 18, 23, 20], label: 'Estable', borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', tension: 0.4, fill: false },
      { data: [8, 6, 9, 5, 7, 4, 6], label: 'Deterioro', borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.4, fill: false }
    ]
  };
  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } } }
  };

  get pieChartLabels() {
    return this.isNutritionist 
      ? [ "Pérdida de Grasa", "Ganancia Muscular", "Manejo de Diabetes", "Rendimiento Deportivo", "Intolerancias / Otros" ]
      : [ "Ansiedad", "Depresión", "PTSD", "Bipolar", "Otros" ];
  }
  public pieChartValues = [ 34, 28, 14, 10, 14 ];
  public pieChartColors = [ '#1a56db', '#0ea5e9', '#10b981', '#f59e0b', '#94a3b8' ];

  public pieChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [ "Cat 1", "Cat 2", "Cat 3", "Cat 4", "Cat 5" ],
    datasets: [ {
      data: this.pieChartValues,
      backgroundColor: this.pieChartColors,
      borderWidth: 0,
      hoverOffset: 4
    } ]
  };
  public pieChartOptions: ChartOptions<'doughnut'> = {
    responsive: true, maintainAspectRatio: false, cutout: '70%',
    plugins: { legend: { display: false } }
  };

  async ngOnInit() {
    this.pieChartData.labels = this.pieChartLabels;
    await this.loadNotifications();
  }
}
