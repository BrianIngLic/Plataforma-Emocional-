import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

@Component({
  selector: 'app-patient-profile',
  standalone: true,
  imports: [CommonModule, MatIconModule, BaseChartDirective],
  templateUrl: './patient-profile.component.html',
  styleUrls: ['./patient-profile.component.scss']
})
export class PatientProfileComponent implements OnInit {
  supabase = inject(SupabaseService).supabase;
  crypto = inject(CryptoService);

  patient: any = null;
  diaryEntries: any[] = [];
  loading = true;

  sessionHistory = [
    { date: "Próximamente", type: "Terapia Individual", duration: "50 min", mood: "Regular", notes: "Historial de sesiones estará disponible en la próxima versión." }
  ];

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'],
    datasets: [
      {
        data: [18, 16, 15, 14, 12, 11, 10, 9],
        label: 'Puntuación PHQ-9',
        borderColor: '#1a56db',
        backgroundColor: 'rgba(26, 86, 219, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, min: 0, max: 27 }
    }
  };

  // Variables del Calendario
  currentDate = new Date();
  monthName = '';
  year = 0;
  calendarDays: number[] = [];
  blankDays: number[] = [];
  selectedDate: number | null = null;
  
  calendarMode: 'days' | 'months' = 'days';
  monthsList = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  constructor(private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadPatientData(id);
    } else {
      this.goBack();
    }
  }

  async loadPatientData(id: string) {
    this.loading = true;
    
    try {
      // 1. Fetch user + profile + clinical record
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('id, profiles(first_name, last_name, avatar_url), student_clinical_records!student_clinical_records_student_id_fkey(known_conditions, additional_notes)')
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
        } else {
          notes = "Sin notas clínicas adicionales guardadas en el expediente.";
        }

        this.patient = {
          id: userData.id,
          firstName: p?.first_name || 'Paciente',
          lastName: p?.last_name || 'Sin Nombre',
          age: 22,
          gender: "Estudiante BUAP",
          diagnosis: conditions && conditions.length > 0 ? conditions.join(' + ') : "Evaluación Pendiente",
          treatmentPlan: "TCC + Monitoreo con EmolA",
          medications: ["Ninguno registrado"],
          sessionCount: 0,
          nextSession: "Por agendar",
          state: "Active",
          riskLevel: conditions && conditions.length > 0 ? "Moderado" : "Bajo",
          notes: notes
        };
      }

      // 2. Fetch diary entries
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
        return '📝'; // Ícono por defecto si no eligió emoción
    }
    return null;
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

  goBack() {
    this.router.navigate(['/psychologist/patients']);
  }
}
