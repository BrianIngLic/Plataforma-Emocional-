import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../core/services/auth.service';
import { FacultyService, Faculty } from '../../../core/services/faculty.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ClinicalService } from '../../../core/services/clinical.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { GamificationService } from '../../../core/services/gamification.service';
import { FeedbackModalComponent } from '../../../shared/components/feedback-modal/feedback-modal.component';
import { ProfileAvatarComponent } from '../../../shared/components/profile-avatar/profile-avatar.component';
import { ArcoSettingsComponent } from '../../../shared/components/arco-settings/arco-settings.component';
import { NgxMaskDirective } from 'ngx-mask';

@Component({
  selector: 'app-student-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    ProfileAvatarComponent,
    ArcoSettingsComponent,
    NgxMaskDirective
  ],
  templateUrl: './student-settings.component.html',
  styleUrls: ['./student-settings.component.scss']
})
export class StudentSettingsComponent implements OnInit {
  authService = inject(AuthService);
  facultyService = inject(FacultyService);
  supabaseService = inject(SupabaseService);
  clinicalService = inject(ClinicalService);
  gamificationService = inject(GamificationService);
  cryptoService = inject(CryptoService);
  dialog = inject(MatDialog);

  faculties: Faculty[] = [];
  selectedFaculty: string = '';
  isSaving = false;

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  isChangingPassword = false;

  hasPsychologist = false;
  hasNutritionist = false;
  inPsychologistQueue = false;
  inNutritionistQueue = false;

  // ponytail: control de pestañas y toggle de origen
  activeTab = 'general'; // general, family_tree, family_details, emergency, security
  isForaneo = false;
  selectedTreeNode: string | null = null; // yo, padre, madre, hermanos, pareja

  firstName = '';
  lastName = '';
  userEmail = '';
  passwordErrorMessage = '';
  passwordSuccessMessage = '';

  get isUpdatingPassword(): boolean {
    return this.isChangingPassword;
  }

  get hasMinLength(): boolean {
    return this.newPassword.length >= 6;
  }
  get hasUppercase(): boolean {
    return /[A-Z]/.test(this.newPassword);
  }
  get hasLowercase(): boolean {
    return /[a-z]/.test(this.newPassword);
  }
  get hasDigit(): boolean {
    return /[0-9]/.test(this.newPassword);
  }
  get isPasswordValid(): boolean {
    return this.hasMinLength && this.hasUppercase && this.hasLowercase && this.hasDigit;
  }

  // ponytail: Propiedades de solo lectura usadas para evaluar la completitud del expediente
  userSexo = '';
  fechaNacimiento = '';
  userCelular = '';

  // ponytail: Propiedades mapeadas directamente a la base de datos (evitan redundancia en JSONB)
  userFaculty = '';
  userProgramaEducativo = '';

  // ponytail: Modelo de datos del expediente estructurado en JSONB (sin campos redundantes)
  expediente = {
    personal: {
      estado_civil: ''
    },
    academico: {
      semestre: '' as any,
      domicilio_actual: {
        estado: 'Puebla',
        municipio: 'Puebla',
        colonia: '',
        calle: '',
        numero: '',
        con_quien_vive: ''
      },
      domicilio_origin: {
        estado: '',
        municipio: '',
        colonia: '',
        calle: '',
        numero: ''
      }
    },
    historia_familiar: {
      padres_estado_civil: '',
      padres_relacion: '',
      padre: {
        estado: '', // presente, ausente, finado
        edad: null as number | null,
        ocupacion: '',
        antecedentes_psiquiatricos: '', // si, no, no_se
        enfermedad_cronica: '',
        tipo_relacion: '',
        nueva_pareja: {
          tiene: '' as any,
          tipo_relacion: '',
          figura_vida: ''
        }
      },
      madre: {
        estado: '', // presente, ausente, finado
        edad: null as number | null,
        ocupacion: '',
        antecedentes_psiquiatricos: '', // si, no, no_se
        enfermedad_cronica: '',
        tipo_relacion: '',
        nueva_pareja: {
          tiene: '' as any,
          tipo_relacion: '',
          figura_vida: ''
        }
      },
      hermanos: {
        tiene: '' as any,
        cantidad: 0,
        numero_hijo: 1,
        tipo_relacion: ''
      },
      pareja: {
        tiene: '' as any,
        genero: '',
        edad: null as number | null,
        ocupacion: '',
        tiempo_relacion: '',
        tipo_relacion: ''
      }
    },
    contactos_emergencia: [
      { nombre: '', parentesco: '', telefono: '' },
      { nombre: '', parentesco: '', telefono: '' }
    ] as any[]
  };

  get currentUser() {
    return this.authService.currentUser();
  }



  async ngOnInit() {
    this.faculties = await this.facultyService.getFaculties();
    const user = this.currentUser;
    if (user) {
      if (user.faculty) this.selectedFaculty = user.faculty;

      // ponytail: Cargar datos de autenticación del usuario actual (correo)
      try {
        const { data: { user: authUser } } = await this.supabaseService.supabase.auth.getUser();
        if (authUser) {
          this.userEmail = authUser.email || '';
        }
      } catch (err) {
        console.warn('Error al cargar correo de auth:', err);
      }
      // ponytail: Cargar el expediente completo de la tabla profiles
      const { data: prof, error: profErr } = await this.supabaseService.supabase
        .from('profiles')
        .select('first_name, last_name, fecha_nacimiento, sexo, faculty, programa_educativo, expediente_completo')
        .eq('user_id', user.id)
        .maybeSingle();

      if (prof) {
        this.firstName = prof.first_name || '';
        this.lastName = prof.last_name || '';
        this.userCelular = user.mobile_phone || '';
        this.fechaNacimiento = prof.fecha_nacimiento || '';
        this.userSexo = prof.sexo || '';
        this.userFaculty = prof.faculty || user.faculty || '';
        this.userProgramaEducativo = prof.programa_educativo || '';

        if (prof.expediente_completo && Object.keys(prof.expediente_completo).length > 0) {
          let decryptedData = null;
          if (prof.expediente_completo.data) {
            try {
              const decryptedText = this.cryptoService.decrypt(prof.expediente_completo.data);
              decryptedData = JSON.parse(decryptedText);
            } catch (err) {
              console.error('Error descifrando expediente:', err);
            }
          } else {
            decryptedData = prof.expediente_completo;
          }

          if (decryptedData) {
            this.expediente = {
              ...this.expediente,
              ...decryptedData
            };
          }

          // ponytail: Asegurar inicialización de estructuras anidadas para evitar errores de tipo undefined en la plantilla
          if (!this.expediente.personal) {
            this.expediente.personal = { estado_civil: '' };
          }
          if (!this.expediente.academico) {
            this.expediente.academico = {
              semestre: '' as any,
              domicilio_actual: { estado: 'Puebla', municipio: 'Puebla', colonia: '', calle: '', numero: '', con_quien_vive: '' },
              domicilio_origin: { estado: '', municipio: '', colonia: '', calle: '', numero: '' }
            };
          }
          if (!this.expediente.academico.domicilio_actual) {
            this.expediente.academico.domicilio_actual = { estado: 'Puebla', municipio: 'Puebla', colonia: '', calle: '', numero: '', con_quien_vive: '' };
          }
          if (!this.expediente.academico.domicilio_origin) {
            this.expediente.academico.domicilio_origin = { estado: '', municipio: '', colonia: '', calle: '', numero: '' };
          }
          if (!this.expediente.historia_familiar) {
            this.expediente.historia_familiar = {} as any;
          }
          if (!this.expediente.historia_familiar.padre) {
            this.expediente.historia_familiar.padre = {} as any;
          }
          if (!this.expediente.historia_familiar.padre.nueva_pareja) {
            this.expediente.historia_familiar.padre.nueva_pareja = { tiene: '' as any, tipo_relacion: '', figura_vida: '' };
          }
          if (!this.expediente.historia_familiar.madre) {
            this.expediente.historia_familiar.madre = {} as any;
          }
          if (!this.expediente.historia_familiar.madre.nueva_pareja) {
            this.expediente.historia_familiar.madre.nueva_pareja = { tiene: '' as any, tipo_relacion: '', figura_vida: '' };
          }

          // Forzar sincronización de campos clave por si cambiaron de forma externa
          this.userCelular = user.mobile_phone || this.userCelular;
          this.fechaNacimiento = prof.fecha_nacimiento || this.fechaNacimiento;
          this.userSexo = prof.sexo || this.userSexo;
          this.userFaculty = prof.faculty || user.faculty || this.userFaculty;
          this.userProgramaEducativo = prof.programa_educativo || this.userProgramaEducativo;

          // Asegurar mínimo de 2 contactos de emergencia
          if (!this.expediente.contactos_emergencia || this.expediente.contactos_emergencia.length < 2) {
            this.expediente.contactos_emergencia = [
              { nombre: '', parentesco: '', telefono: '' },
              { nombre: '', parentesco: '', telefono: '' }
            ];
          }

          // Cargar el switch de foráneo
          this.isForaneo = !!(this.expediente.academico.domicilio_origin && this.expediente.academico.domicilio_origin.estado);
        }
      }

      // Cargar estatus de especialistas y fila virtual
      const { data: rec } = await this.supabaseService.supabase
        .from('student_clinical_records')
        .select('primary_psychologist_id, primary_nutritionist_id')
        .eq('student_id', user.id)
        .maybeSingle();

      if (rec) {
        this.hasPsychologist = !!rec.primary_psychologist_id;
        this.hasNutritionist = !!rec.primary_nutritionist_id;
      }

      const { data: queue } = await this.supabaseService.supabase
        .from('virtual_queue')
        .select('specialty')
        .eq('student_id', user.id);

      if (queue) {
        queue.forEach((q: any) => {
          if (q.specialty === 'psychologist') this.inPsychologistQueue = true;
          if (q.specialty === 'nutritionist') this.inNutritionistQueue = true;
        });
      }
    }
  }

  // ponytail: Cálculo dinámico de completitud de expediente
  getCompletionPercentage(): number {
    let totalPoints = 0;
    let earnedPoints = 0;

    // Contacto y Personal (4 campos)
    totalPoints += 4;
    if (this.userCelular) earnedPoints++;
    if (this.fechaNacimiento) earnedPoints++;
    if (this.expediente.personal.estado_civil) earnedPoints++;
    if (this.userSexo) earnedPoints++;

    // Académico (3 campos)
    totalPoints += 3;
    if (this.expediente.academico.semestre) earnedPoints++;
    if (this.userFaculty) earnedPoints++;
    if (this.userProgramaEducativo) earnedPoints++;

    // Domicilio actual (5 campos)
    totalPoints += 5;
    const dom = this.expediente.academico.domicilio_actual;
    if (dom.estado) earnedPoints++;
    if (dom.municipio) earnedPoints++;
    if (dom.colonia) earnedPoints++;
    if (dom.calle) earnedPoints++;
    if (dom.con_quien_vive) earnedPoints++;

    // Domicilio origen (si es foráneo)
    if (this.isForaneo) {
      totalPoints += 4;
      const domO = this.expediente.academico.domicilio_origin;
      if (domO.estado) earnedPoints++;
      if (domO.municipio) earnedPoints++;
      if (domO.colonia) earnedPoints++;
      if (domO.calle) earnedPoints++;
    }

    // Historia Familiar - Padres (2 campos)
    totalPoints += 2;
    if (this.expediente.historia_familiar.padres_estado_civil) earnedPoints++;
    if (this.expediente.historia_familiar.padres_relacion) earnedPoints++;

    // Padre (según estatus)
    const f = this.expediente.historia_familiar.padre;
    if (f.estado === 'finado' || f.estado === 'ausente') {
      totalPoints += 1;
      if (f.estado) earnedPoints++;
    } else {
      totalPoints += 3;
      if (f.estado) earnedPoints++;
      if (f.ocupacion) earnedPoints++;
      if (f.tipo_relacion) earnedPoints++;
    }

    // Madre (según estatus)
    const m = this.expediente.historia_familiar.madre;
    if (m.estado === 'finado' || m.estado === 'ausente') {
      totalPoints += 1;
      if (m.estado) earnedPoints++;
    } else {
      totalPoints += 3;
      if (m.estado) earnedPoints++;
      if (m.ocupacion) earnedPoints++;
      if (m.tipo_relacion) earnedPoints++;
    }

    // ponytail: Nueva pareja si están separados (conyugal)
    if (this.expediente.historia_familiar.padres_estado_civil === 'Divorciados') {
      if (f.estado !== 'finado' && f.estado !== 'ausente') {
        totalPoints++;
        if (f.nueva_pareja?.tiene !== undefined && f.nueva_pareja?.tiene !== '') {
          earnedPoints++;
          if (f.nueva_pareja.tiene === true || f.nueva_pareja.tiene === 'true' || f.nueva_pareja.tiene === 'si' || f.nueva_pareja.tiene === 'Sí') {
            totalPoints += 2;
            if (f.nueva_pareja.tipo_relacion) earnedPoints++;
            if (f.nueva_pareja.figura_vida) earnedPoints++;
          }
        }
      }

      if (m.estado !== 'finado' && m.estado !== 'ausente') {
        totalPoints++;
        if (m.nueva_pareja?.tiene !== undefined && m.nueva_pareja?.tiene !== '') {
          earnedPoints++;
          if (m.nueva_pareja.tiene === true || m.nueva_pareja.tiene === 'true' || m.nueva_pareja.tiene === 'si' || m.nueva_pareja.tiene === 'Sí') {
            totalPoints += 2;
            if (m.nueva_pareja.tipo_relacion) earnedPoints++;
            if (m.nueva_pareja.figura_vida) earnedPoints++;
          }
        }
      }
    }

    // Hermanos
    totalPoints += 1;
    if (this.expediente.historia_familiar.hermanos.tiene === true || this.expediente.historia_familiar.hermanos.tiene === 'true' || this.expediente.historia_familiar.hermanos.tiene === 'si' || this.expediente.historia_familiar.hermanos.tiene === 'Sí') {
      earnedPoints++;
      totalPoints += 2; // cantidad y tipo_relacion
      if (this.expediente.historia_familiar.hermanos.cantidad) earnedPoints++;
      if (this.expediente.historia_familiar.hermanos.tipo_relacion) earnedPoints++;
    } else if (this.expediente.historia_familiar.hermanos.tiene === false || this.expediente.historia_familiar.hermanos.tiene === 'false' || this.expediente.historia_familiar.hermanos.tiene === 'no' || this.expediente.historia_familiar.hermanos.tiene === 'No') {
      earnedPoints++;
    }

    // Pareja
    totalPoints += 1;
    if (this.expediente.historia_familiar.pareja.tiene === true || this.expediente.historia_familiar.pareja.tiene === 'true' || this.expediente.historia_familiar.pareja.tiene === 'si' || this.expediente.historia_familiar.pareja.tiene === 'Sí') {
      earnedPoints++;
      totalPoints += 3; // edad, ocupacion, tipo_relacion
      if (this.expediente.historia_familiar.pareja.edad) earnedPoints++;
      if (this.expediente.historia_familiar.pareja.ocupacion) earnedPoints++;
      if (this.expediente.historia_familiar.pareja.tipo_relacion) earnedPoints++;
    } else if (this.expediente.historia_familiar.pareja.tiene === false || this.expediente.historia_familiar.pareja.tiene === 'false' || this.expediente.historia_familiar.pareja.tiene === 'no' || this.expediente.historia_familiar.pareja.tiene === 'No') {
      earnedPoints++;
    }

    // Contactos de emergencia (4 campos para los dos requeridos)
    totalPoints += 4;
    const contacts = this.expediente.contactos_emergencia;
    if (contacts.length >= 1) {
      if (contacts[0].nombre) earnedPoints++;
      if (contacts[0].telefono) earnedPoints++;
    }
    if (contacts.length >= 2) {
      if (contacts[1].nombre) earnedPoints++;
      if (contacts[1].telefono) earnedPoints++;
    }

    return Math.round((earnedPoints / totalPoints) * 100);
  }

  // ponytail: Verifica si un nodo del árbol familiar está completo en datos
  isNodeComplete(node: string): boolean {
    if (node === 'yo') {
      return !!(this.userCelular && this.fechaNacimiento && this.expediente.personal.estado_civil && this.userSexo);
    }
    if (node === 'parents_relation') {
      return !!(this.expediente.historia_familiar.padres_estado_civil && this.expediente.historia_familiar.padres_relacion);
    }
    if (node === 'padre') {
      const f = this.expediente.historia_familiar.padre;
      const base = f.estado === 'ausente' || f.estado === 'finado' || !!(f.edad && f.ocupacion && f.tipo_relacion);
      if (!base) return false;
      if (this.expediente.historia_familiar.padres_estado_civil === 'Divorciados') {
        if (f.nueva_pareja?.tiene === undefined || f.nueva_pareja?.tiene === '') return false;
        if (f.nueva_pareja.tiene === true || f.nueva_pareja.tiene === 'true' || f.nueva_pareja.tiene === 'si' || f.nueva_pareja.tiene === 'Sí') {
          return !!(f.nueva_pareja.tipo_relacion && f.nueva_pareja.figura_vida);
        }
      }
      return true;
    }
    if (node === 'madre') {
      const m = this.expediente.historia_familiar.madre;
      const base = m.estado === 'ausente' || m.estado === 'finado' || !!(m.edad && m.ocupacion && m.tipo_relacion);
      if (!base) return false;
      if (this.expediente.historia_familiar.padres_estado_civil === 'Divorciados') {
        if (m.nueva_pareja?.tiene === undefined || m.nueva_pareja?.tiene === '') return false;
        if (m.nueva_pareja.tiene === true || m.nueva_pareja.tiene === 'true' || m.nueva_pareja.tiene === 'si' || m.nueva_pareja.tiene === 'Sí') {
          return !!(m.nueva_pareja.tipo_relacion && m.nueva_pareja.figura_vida);
        }
      }
      return true;
    }
    if (node === 'hermanos') {
      const h = this.expediente.historia_familiar.hermanos;
      return !h.tiene || !!(h.cantidad && h.tipo_relacion);
    }
    if (node === 'pareja') {
      const p = this.expediente.historia_familiar.pareja;
      return !p.tiene || !!(p.edad && p.ocupacion && p.tipo_relacion);
    }
    return false;
  }

  selectTreeNode(node: string) {
    if (node === 'yo') {
      this.selectedTreeNode = null;
      return;
    }
    this.selectedTreeNode = node;
  }

  // ponytail: Gestión dinámica de contactos de emergencia
  addEmergencyContact() {
    this.expediente.contactos_emergencia.push({
      nombre: '',
      parentesco: 'Otros',
      telefono: ''
    });
  }

  removeEmergencyContact(index: number) {
    if (this.expediente.contactos_emergencia.length > 2) {
      this.expediente.contactos_emergencia.splice(index, 1);
    } else {
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: {
          type: 'error',
          title: 'Restricción de Seguridad',
          message: 'Debes registrar al menos 2 contactos de emergencia para salvaguardar tu bienestar.'
        }
      });
    }
  }

  async solicitarEspecialista(specialty: 'psychologist' | 'nutritionist') {
    const user = this.currentUser;
    if (!user || !user.id) return;
    
    if (!this.selectedFaculty) {
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { 
          type: 'error', 
          title: 'Facultad Requerida', 
          message: 'Por favor selecciona y guarda tu facultad primero para poder asignarte un especialista de tu área.' 
        }
      });
      return;
    }

    this.isSaving = true;
    try {
      const roleId = specialty === 'psychologist' ? 3 : 4;
      const assignedId = await this.clinicalService.getSpecialistWithLeastLoad(roleId, user.id);
      
      if (assignedId) {
        const field = specialty === 'psychologist' ? 'primary_psychologist_id' : 'primary_nutritionist_id';
        const { data: existing } = await this.supabaseService.supabase
          .from('student_clinical_records')
          .select('student_id')
          .eq('student_id', user.id)
          .maybeSingle();

        if (existing) {
          await this.supabaseService.supabase
            .from('student_clinical_records')
            .update({ [field]: assignedId })
            .eq('student_id', user.id);
        } else {
          await this.supabaseService.supabase
            .from('student_clinical_records')
            .insert({
              student_id: user.id,
              [field]: assignedId,
              known_conditions: ['Test_Completado'],
              consent_given: true
            });
        }

        if (specialty === 'psychologist') this.hasPsychologist = true;
        else this.hasNutritionist = true;

        this.dialog.open(FeedbackModalComponent, {
          width: '400px',
          data: { 
            type: 'success', 
            title: 'Asignación Exitosa', 
            message: `Se te ha asignado un ${specialty === 'psychologist' ? 'psicólogo' : 'nutriólogo'} de tu facultad exitosamente.` 
          }
        });
      } else {
        const { error: queueErr } = await this.supabaseService.supabase
          .from('virtual_queue')
          .insert({
            student_id: user.id,
            specialty: specialty,
            faculty: this.selectedFaculty
          });

        if (specialty === 'psychologist') this.inPsychologistQueue = true;
        else this.inNutritionistQueue = true;

        this.dialog.open(FeedbackModalComponent, {
          width: '400px',
          data: { 
            type: 'success', 
            title: 'Fila de Espera', 
            message: `Todos los especialistas de tu facultad están saturados. Has sido colocado en la fila de espera virtual.` 
          }
        });
      }
    } catch (e) {
      console.error(e);
      this.dialog.open(FeedbackModalComponent, {
        width: '400px',
        data: { type: 'error', title: 'Error', message: 'No se pudo procesar la solicitud de asignación.' }
      });
    } finally {
      this.isSaving = false;
    }
  }

  // ponytail: confirmSave recibe sección para validar solo lo necesario
  confirmSave(section?: string) {
    const dialogRef = this.dialog.open(FeedbackModalComponent, {
      width: '400px',
      data: {
        type: 'confirm',
        title: 'Confirmar Cambios',
        message: '¿Estás seguro que deseas actualizar los datos de tu expediente?',
        btnText: 'Sí, guardar',
        cancelBtnText: 'Cancelar'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.performSave(section);
      }
    });
  }

  // ponytail: Otorgar XP al completar al 100% el expediente
  async checkAndAwardXp() {
    const user = this.currentUser;
    if (!user || !user.id) return;

    if (this.getCompletionPercentage() === 100 && !(this.expediente as any).xp_awarded) {
      (this.expediente as any).xp_awarded = true;
      try {
        const { data: userStreak } = await this.supabaseService.supabase
          .from('user_streaks')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        const xpToReward = 150;
        if (userStreak) {
          await this.supabaseService.supabase
            .from('user_streaks')
            .update({ total_xp: userStreak.total_xp + xpToReward })
            .eq('user_id', user.id);
        } else {
          await this.supabaseService.supabase
            .from('user_streaks')
            .insert({
              user_id: user.id,
              current_streak: 1,
              best_streak: 1,
              last_activity_date: new Date().toISOString().split('T')[0],
              total_xp: xpToReward
            });
        }
        
        this.showLocalAchievementToast('Expediente Familiar Completo', xpToReward);
        await this.gamificationService.loadGamificationData();
      } catch (err) {
        console.error('Error al otorgar XP de gamificación:', err);
      }
    }
  }

  showLocalAchievementToast(title: string, xpReward: number) {
    let container = document.getElementById('achievement-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'achievement-toast-container';
      container.className = 'achievement-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
      <div class="toast-icon-wrapper">🏆</div>
      <div class="toast-body">
        <div class="toast-subtitle">¡Logro Desbloqueado!</div>
        <h4 class="toast-title">${title}</h4>
        <div class="toast-xp">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 2px;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <span>+${xpReward} XP</span>
        </div>
      </div>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('active'), 50);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        toast.remove();
        if (container && container.childNodes.length === 0) {
          container.remove();
        }
      }, 500);
    }, 5000);
  }

  // ponytail: performSave valida solo la sección modificada para evitar bloqueos en guardado parcial
  async performSave(section?: string) {
    this.isSaving = true;
    const user = this.authService.currentUser();

    if (user && user.id) {
      if (section === 'personal') {
        if (!this.firstName || !this.lastName || !this.userCelular || !this.fechaNacimiento || !this.userSexo || !this.expediente.personal.estado_civil) {
          this.isSaving = false;
          this.dialog.open(FeedbackModalComponent, {
            width: '400px',
            data: {
              type: 'error',
              title: 'Selección Inválida',
              message: 'Por favor, completa todos los campos obligatorios de Datos Personales (Nombre, Apellido, Celular, Fecha de Nacimiento, Sexo y Estado Civil).'
            }
          });
          return;
        }

        // ponytail: Validar número de teléfono celular a 10 dígitos
        const cleanCelular = this.userCelular.replace(/\D/g, '');
        if (cleanCelular.length !== 10) {
          this.isSaving = false;
          this.dialog.open(FeedbackModalComponent, {
            width: '400px',
            data: {
              type: 'error',
              title: 'Teléfono Inválido',
              message: 'El número de teléfono celular debe tener exactamente 10 dígitos.'
            }
          });
          return;
        }
      } else if (section === 'academic') {
        if (!this.userFaculty || !this.expediente.academico.semestre) {
          this.isSaving = false;
          this.dialog.open(FeedbackModalComponent, {
            width: '400px',
            data: {
              type: 'error',
              title: 'Selección Inválida',
              message: 'Por favor, selecciona una opción válida en Unidad Académica y Semestre.'
            }
          });
          return;
        }
      } else if (section === 'domicilio') {
        if (!this.expediente.academico.domicilio_actual.con_quien_vive) {
          this.isSaving = false;
          this.dialog.open(FeedbackModalComponent, {
            width: '400px',
            data: {
              type: 'error',
              title: 'Selección Inválida',
              message: 'Por favor, selecciona con quién vives actualmente.'
            }
          });
          return;
        }
      } else if (section === 'emergency') {
        if (this.expediente.contactos_emergencia && this.expediente.contactos_emergencia.length >= 2) {
          const c1 = this.expediente.contactos_emergencia[0];
          const c2 = this.expediente.contactos_emergencia[1];
          if (!c1.nombre || !c1.parentesco || !c1.telefono || !c2.nombre || !c2.parentesco || !c2.telefono) {
            this.isSaving = false;
            this.dialog.open(FeedbackModalComponent, {
              width: '400px',
              data: {
                type: 'error',
                title: 'Contactos Incompletos',
                message: 'Por favor, completa todos los campos (Nombre, Parentesco y Teléfono) de tus dos contactos de emergencia obligatorios.'
              }
            });
            return;
          }
          // ponytail: Validar 10 dígitos para teléfonos de contactos de emergencia
          const t1 = c1.telefono.replace(/\D/g, '');
          const t2 = c2.telefono.replace(/\D/g, '');
          if (t1.length !== 10 || t2.length !== 10) {
            this.isSaving = false;
            this.dialog.open(FeedbackModalComponent, {
              width: '400px',
              data: {
                type: 'error',
                title: 'Teléfono Inválido',
                message: 'Los números de teléfono de los contactos de emergencia deben tener exactamente 10 dígitos.'
              }
            });
            return;
          }
        }
      }

      // Si no es foráneo, limpiar domicilio de origen en el payload
      if (!this.isForaneo) {
        this.expediente.academico.domicilio_origin = {
          estado: '',
          municipio: '',
          colonia: '',
          calle: '',
          numero: ''
        };
      }

      const plainTextJson = JSON.stringify(this.expediente);
      const encryptedText = this.cryptoService.encrypt(plainTextJson);

      const updatePayload: any = {
        first_name: this.firstName,
        last_name: this.lastName,
        faculty: this.userFaculty || this.selectedFaculty,
        programa_educativo: this.userProgramaEducativo || null,
        fecha_nacimiento: this.fechaNacimiento || null,
        sexo: this.userSexo,
        expediente_completo: { data: encryptedText }
      };

      const { error } = await this.supabaseService.supabase
          .from('profiles')
          .update(updatePayload)
          .eq('user_id', user.id);

      if (!error) {
        await this.supabaseService.supabase
            .from('users')
            .update({ mobile_phone: this.userCelular })
            .eq('id', user.id);
      }

      this.isSaving = false;

      if (!error) {
        // Actualizar datos del currentUser signal
        this.authService.currentUser.set({
          ...user,
          name: `${this.firstName} ${this.lastName}`.trim() || user.name,
          faculty: this.userFaculty || user.faculty,
          mobile_phone: this.userCelular
        });

        // Intentar otorgar XP si cumple 100% de completado
        await this.checkAndAwardXp();

        this.dialog.open(FeedbackModalComponent, {
          width: '400px',
          data: { type: 'success', title: 'Datos Guardados', message: 'Tus datos clínicos y de expediente han sido actualizados correctamente.' }
        });
      } else {
        this.dialog.open(FeedbackModalComponent, {
          width: '400px',
          data: { type: 'error', title: 'Error', message: 'No se pudo guardar la configuración en la base de datos.' }
        });
      }
    } else {
      this.isSaving = false;
    }
  }

  // ponytail: Desplazamiento suave para la guía Notion-style
  scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  confirmUpdatePassword() {
    if (!this.newPassword || this.newPassword.length < 6) {
      alert('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      alert('Las contraseñas nuevas no coinciden.');
      return;
    }

    const dialogRef = this.dialog.open(FeedbackModalComponent, {
      width: '400px',
      data: {
        type: 'confirm',
        title: 'Confirmar Cambio de Contraseña',
        message: '¿Estás seguro que deseas actualizar tu contraseña?',
        btnText: 'Actualizar',
        cancelBtnText: 'Cancelar'
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        await this.performUpdatePassword();
      }
    });
  }

  async performUpdatePassword() {
    this.isChangingPassword = true;
    try {
      const success = await this.authService.updatePasswordWithVerification(this.currentPassword, this.newPassword);
      if (success) {
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.dialog.open(FeedbackModalComponent, {
          width: '400px',
          data: {
            type: 'success',
            title: 'Contraseña Actualizada',
            message: 'Tu contraseña ha sido actualizada exitosamente.'
          }
        });
      } else {
        alert('No se pudo actualizar la contraseña. Verifica tu contraseña actual.');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Error al cambiar la contraseña.');
    } finally {
      this.isChangingPassword = false;
    }
  }

  changePassword() {
    this.confirmUpdatePassword();
  }
}
