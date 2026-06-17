import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
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
  patient: any = {
    id: "3",
    firstName: "Sara",
    lastName: "Lindqvist",
    age: 28,
    gender: "Femenino",
    diagnosis: "Trastorno Depresivo Mayor + Ideación Suicida",
    treatmentPlan: "TCC + Intervención de Crisis + Farmacoterapia",
    medications: ["Fluoxetina 40mg", "Quetiapina 100mg"],
    sessionCount: 48,
    nextSession: "17 de Junio, 11:15 AM",
    state: "Critical",
    riskLevel: "Alto",
    notes: "CRÍTICO: Ideación de autolesión reportada en la última sesión y por el bot EmolA. Plan de seguridad activado."
  };

  sessionHistory = [
    { date: "16 Jun 2026", type: "Intervención Crisis", duration: "60 min", mood: "Malo", notes: "Ataque de pánico reportado. Revisión de plan de seguridad." },
    { date: "08 Jun 2026", type: "Terapia Individual", duration: "50 min", mood: "Regular", notes: "Practicando estrategias de control de ansiedad." }
  ];

  diaryEntries = [
    { date: "Ayer, 22:30", mood: "Ansioso", moodColor: "text-red", moodIcon: "sentiment_very_dissatisfied", content: "No puedo dejar de pensar en lo mismo. Siento una presión enorme en el pecho." },
    { date: "Hace 3 días", mood: "Triste", moodColor: "text-amber", moodIcon: "sentiment_dissatisfied", content: "Hoy no me quise levantar de la cama. Todo parece gris." }
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

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    // const id = this.route.snapshot.paramMap.get('id');
    // En producción cargaría los datos según el ID.
  }

  goBack() {
    this.router.navigate(['/psychologist/patients']);
  }
}
