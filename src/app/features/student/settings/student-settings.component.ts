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
    ArcoSettingsComponent
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

  hasPsychologist = false;
  hasNutritionist = false;
  inPsychologistQueue = false;
  inNutritionistQueue = false;

  newPassword = '';
  confirmPassword = '';
  passwordErrorMessage = '';
  passwordSuccessMessage = '';
  isUpdatingPassword = false;

  // ponytail: control de pestañas y toggle de origen
  activeTab = 'general'; // general, family_tree, family_details, emergency, security
  isForaneo = false;
  selectedTreeNode: string | null = 'yo'; // yo, padre, madre, hermanos, pareja

  // ponytail: Modelo de datos del expediente estructurado en JSONB
  expediente = {
    contacto: {
      nombre: '',
      matricula: '',
      correo: '',
      telefono: '',
      fecha_nacimiento: ''
    },
    personal: {
      estado_civil: 'Soltero/a',
      sexo: ''
    },
    academico: {
      semestre: 1,
      unidad_academica: '',
      programa_educativo: '',
      domicilio_actual: {
        estado: 'Puebla',
        municipio: 'Puebla',
        colonia: '',
        calle: '',
        numero: '',
        con_quien_vive: 'Solo'
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
      padres_estado_civil: 'Casados',
      padres_relacion: 'Buena',
      padre: {
        estado: 'presente', // presente, ausente, finado
        edad: null as number | null,
        ocupacion: '',
        antecedentes_psiquiatricos: 'no_se', // si, no, no_se
        enfermedad_cronica: '',
        tipo_relacion: 'Buena'
      },
      madre: {
        estado: 'presente', // presente, ausente, finado
        edad: null as number | null,
        ocupacion: '',
        antecedentes_psiquiatricos: 'no_se', // si, no, no_se
        enfermedad_cronica: '',
        tipo_relacion: 'Buena'
      },
      hermanos: {
        tiene: false,
        cantidad: 0,
        numero_hijo: 1,
        tipo_relacion: 'Buena'
      },
      pareja: {
        tiene: false,
        genero: '',
        edad: null as number | null,
        ocupacion: '',
        tiempo_relacion: '',
        tipo_relacion: 'Buena'
      }
    },
    contactos_emergencia: [
      { nombre: '', parentesco: 'Madre/padre/tutor legal', telefono: '' },
      { nombre: '', parentesco: 'Pareja/amistad/otros', telefono: '' }
    ] as any[]
  };

  get currentUser() {
    return this.authService.currentUser();
  }

  get passwordValue(): string {
    return this.newPassword;
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
    return /\d/.test(this.newPassword);
  }

  get isPasswordValid(): boolean {
    return this.hasMinLength && this.hasUppercase && this.hasLowercase && this.hasDigit;
  }

  async changePassword() {
    if (!this.isPasswordValid || this.newPassword !== this.confirmPassword) {
      return;
    }

    this.isUpdatingPassword = true;
    this.passwordErrorMessage = '';
    this.passwordSuccessMessage = '';

    try {
      const success = await this.authService.updatePassword(this.newPassword);
      this.isUpdatingPassword = false;

      if (success) {
        this.passwordSuccessMessage = '¡Contraseña actualizada con éxito!';
        this.newPassword = '';
        this.confirmPassword = '';
        
        this.dialog.open(FeedbackModalComponent, {
          width: '400px',
          data: { type: 'success', title: 'Contraseña Actualizada', message: 'Tu contraseña ha sido cambiada correctamente.' }
        });
      } else {
        this.passwordErrorMessage = 'No se pudo actualizar la contraseña. Inténtalo de nuevo.';
      }
    } catch (e: any) {
      this.isUpdatingPassword = false;
      if (e.message?.toLowerCase().includes('leaked') || e.message?.toLowerCase().includes('weak_password')) {
        this.passwordErrorMessage = 'Esta contraseña ha sido expuesta en filtraciones de datos públicas. Por seguridad, por favor elige una contraseña diferente.';
      } else {
        this.passwordErrorMessage = e.message || 'Hubo un error al actualizar la contraseña.';
      }
    }
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
          this.expediente.contacto.correo = authUser.email || '';
        }
      } catch (err) {
        console.warn('No se pudo cargar el correo de auth:', err);
      }

      // ponytail: Cargar el expediente completo de la tabla profiles
      const { data: prof, error: profErr } = await this.supabaseService.supabase
        .from('profiles')
        .select('first_name, last_name, celular, fecha_nacimiento, sexo, expediente_completo')
        .eq('user_id', user.id)
        .maybeSingle();

      if (prof) {
        this.expediente.contacto.nombre = `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || user.name;
        this.expediente.contacto.telefono = prof.celular || '';
        this.expediente.contacto.fecha_nacimiento = prof.fecha_nacimiento || '';
        this.expediente.personal.sexo = prof.sexo || '';

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

          // Forzar sincronización de campos clave por si cambiaron de forma externa
          this.expediente.contacto.nombre = `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || this.expediente.contacto.nombre;
          this.expediente.contacto.telefono = prof.celular || this.expediente.contacto.telefono;
          this.expediente.contacto.fecha_nacimiento = prof.fecha_nacimiento || this.expediente.contacto.fecha_nacimiento;
          this.expediente.personal.sexo = prof.sexo || this.expediente.personal.sexo;

          // Asegurar mínimo de 2 contactos de emergencia
          if (!this.expediente.contactos_emergencia || this.expediente.contactos_emergencia.length < 2) {
            this.expediente.contactos_emergencia = [
              { nombre: '', parentesco: 'Madre/padre/tutor legal', telefono: '' },
              { nombre: '', parentesco: 'Pareja/amistad/otros', telefono: '' }
            ];
          }

          // Cargar el switch de foráneo
          this.isForaneo = !!(this.expediente.academico.domicilio_origin && this.expediente.academico.domicilio_origin.estado);
        } else {
          this.expediente.contacto.matricula = user.matricula;
          this.expediente.academico.unidad_academica = user.faculty || '';
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
    if (this.expediente.contacto.telefono) earnedPoints++;
    if (this.expediente.contacto.fecha_nacimiento) earnedPoints++;
    if (this.expediente.personal.estado_civil) earnedPoints++;
    if (this.expediente.personal.sexo) earnedPoints++;

    // Académico (3 campos)
    totalPoints += 3;
    if (this.expediente.academico.semestre) earnedPoints++;
    if (this.expediente.academico.unidad_academica) earnedPoints++;
    if (this.expediente.academico.programa_educativo) earnedPoints++;

    // Domicilio actual (4 campos)
    totalPoints += 4;
    const dom = this.expediente.academico.domicilio_actual;
    if (dom.estado) earnedPoints++;
    if (dom.municipio) earnedPoints++;
    if (dom.colonia) earnedPoints++;
    if (dom.calle) earnedPoints++;

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

    // Padre (3 campos)
    totalPoints += 3;
    const f = this.expediente.historia_familiar.padre;
    if (f.estado) earnedPoints++;
    if (f.ocupacion) earnedPoints++;
    if (f.tipo_relacion) earnedPoints++;

    // Madre (3 campos)
    totalPoints += 3;
    const m = this.expediente.historia_familiar.madre;
    if (m.estado) earnedPoints++;
    if (m.ocupacion) earnedPoints++;
    if (m.tipo_relacion) earnedPoints++;

    // Hermanos (1 campo)
    totalPoints += 1;
    if (this.expediente.historia_familiar.hermanos.tiene !== undefined) earnedPoints++;

    // Pareja (1 campo)
    totalPoints += 1;
    if (this.expediente.historia_familiar.pareja.tiene !== undefined) earnedPoints++;

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
      return !!(this.expediente.contacto.telefono && this.expediente.contacto.fecha_nacimiento && this.expediente.personal.estado_civil && this.expediente.personal.sexo);
    }
    if (node === 'padre') {
      const f = this.expediente.historia_familiar.padre;
      return f.estado === 'ausente' || f.estado === 'finado' || !!(f.edad && f.ocupacion && f.tipo_relacion);
    }
    if (node === 'madre') {
      const m = this.expediente.historia_familiar.madre;
      return m.estado === 'ausente' || m.estado === 'finado' || !!(m.edad && m.ocupacion && m.tipo_relacion);
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
    this.selectedTreeNode = node;
  }

  // ponytail: Gestión dinámica de contactos de emergencia
  addEmergencyContact() {
    this.expediente.contactos_emergencia.push({
      nombre: '',
      parentesco: 'Pareja/amistad/otros',
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

  confirmSave() {
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
        this.performSave();
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

  async performSave() {
    this.isSaving = true;
    const user = this.authService.currentUser();

    if (user && user.id) {
      // ponytail: Validar que no se guarde con la opción por defecto en combos obligatorios
      if (!this.expediente.personal.sexo || 
          !this.expediente.academico.unidad_academica || 
          !this.expediente.academico.semestre || 
          !this.expediente.academico.domicilio_actual.con_quien_vive || 
          !this.expediente.personal.estado_civil) {
        
        this.isSaving = false;
        this.dialog.open(FeedbackModalComponent, {
          width: '400px',
          data: { 
            type: 'error', 
            title: 'Selección Inválida', 
            message: 'Por favor, selecciona una opción válida en todos los menús desplegables obligatorios (Sexo, Unidad Académica, Semestre, Con quién vives y Estado Civil).' 
          }
        });
        return;
      }

      if (this.expediente.contactos_emergencia && this.expediente.contactos_emergencia.length >= 2) {
        if (!this.expediente.contactos_emergencia[0].parentesco || !this.expediente.contactos_emergencia[1].parentesco) {
          this.isSaving = false;
          this.dialog.open(FeedbackModalComponent, {
            width: '400px',
            data: { 
              type: 'error', 
              title: 'Parentesco Vacío', 
              message: 'Por favor, selecciona el parentesco de tus dos contactos de emergencia obligatorios.' 
            }
          });
          return;
        }
      }

      // Separar nombre y apellido para no corromper campos antiguos
      const nameVal = this.expediente.contacto.nombre || user.name;
      const spaceIdx = nameVal.indexOf(' ');
      const firstName = spaceIdx !== -1 ? nameVal.substring(0, spaceIdx) : nameVal;
      const lastName = spaceIdx !== -1 ? nameVal.substring(spaceIdx + 1) : '';

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
        first_name: firstName,
        last_name: lastName,
        faculty: this.expediente.academico.unidad_academica || this.selectedFaculty,
        celular: this.expediente.contacto.telefono,
        fecha_nacimiento: this.expediente.contacto.fecha_nacimiento || null,
        sexo: this.expediente.personal.sexo,
        expediente_completo: { data: encryptedText }
      };

      const { error } = await this.supabaseService.supabase
        .from('profiles')
        .update(updatePayload)
        .eq('user_id', user.id);

      this.isSaving = false;

      if (!error) {
        // Actualizar datos del currentUser signal
        this.authService.currentUser.set({
          ...user,
          name: nameVal,
          faculty: this.expediente.academico.unidad_academica || user.faculty,
          mobile_phone: this.expediente.contacto.telefono
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
}
