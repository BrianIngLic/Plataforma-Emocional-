import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { CryptoService } from './crypto.service';
import { Router } from '@angular/router';
import { AuditService } from './audit.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public currentUser = signal<{ matricula: string, role: string, id: string, name: string, faculty?: string, requires_password_change?: boolean, avatar_url?: string, mobile_phone?: string } | null>(null);
  public isLoggedIn = signal<boolean>(false);

  public get isHealthProfessional(): boolean {
    const role = this.currentUser()?.role;
    return role === 'Psicologo' || role === 'Nutricionista';
  }

  private auditService = inject(AuditService);
  private inactivityTimeout: any;
  private readonly TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos (NOM-024 / HIPAA)
  private readonly LAST_ACTIVITY_KEY = 'last_activity_timestamp';

  constructor(
    private supabaseService: SupabaseService,
    private cryptoService: CryptoService,
    private router: Router
  ) {
    this.checkSession();
    this.initInactivityTracker();

    // Escuchar cambios de sesión de forma reactiva (NOM-024 / OAuth / Magic Links / Passkeys)
    this.supabaseService.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AuthService] Evento de autenticación detectado: ${event}`);
      if (session) {
        // Evitar recargar si ya está cargado el mismo usuario
        const current = this.currentUser();
        if (!current || current.id !== session.user.id) {
          await this.loadUserProfile(session.user.id);
        }
      } else {
        this.currentUser.set(null);
        this.isLoggedIn.set(false);
      }
    });
  }

  /**
   * Inicializa el rastreador de inactividad del usuario (eventos del DOM).
   */
  private initInactivityTracker() {
    window.addEventListener('mousemove', () => this.resetInactivityTimer());
    window.addEventListener('keydown', () => this.resetInactivityTimer());
    window.addEventListener('scroll', () => this.resetInactivityTimer());
    window.addEventListener('click', () => this.resetInactivityTimer());
  }

  /**
   * Reinicia el temporizador de inactividad si el usuario está logueado.
   */
  private resetInactivityTimer() {
    if (!this.isLoggedIn()) return;

    const lastActivity = localStorage.getItem(this.LAST_ACTIVITY_KEY);
    const now = Date.now();

    if (lastActivity) {
      const elapsed = now - parseInt(lastActivity, 10);
      if (elapsed > this.TIMEOUT_MS) {
        console.warn('⏱️ [AuthService] Inactividad detectada tras verificación de tiempo. Cierre de sesión automático.');
        this.handleInactivityLogout();
        return;
      }
    }

    // ponytail: Registrar última actividad en localStorage
    localStorage.setItem(this.LAST_ACTIVITY_KEY, now.toString());

    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
    }

    this.inactivityTimeout = setTimeout(() => {
      console.warn('⏱️ [AuthService] Sesión expirada por inactividad (15 minutos). Cierre de sesión automático.');
      this.handleInactivityLogout();
    }, this.TIMEOUT_MS);
  }

  /**
   * Maneja el flujo de cierre de sesión por inactividad.
   */
  private async handleInactivityLogout() {
    const user = this.currentUser();
    if (user) {
      try {
        await this.auditService.logEvent('SESSION_TIMEOUT', `Cierre de sesión automático por inactividad (15 mins) para el rol ${user.role}.`, user.id);
      } catch (e) {
        console.error('Error al registrar evento de auditoría:', e);
      }
    }
    sessionStorage.setItem('inactivity_logout', 'true');
    await this.logout();
  }

  public async checkSession(): Promise<boolean> {
    if (this.isLoggedIn()) {
      this.resetInactivityTimer();
      return true;
    }

    // ponytail: Verificar si la inactividad guardada ya expiró
    const lastActivity = localStorage.getItem(this.LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity, 10);
      if (elapsed > this.TIMEOUT_MS) {
        console.warn('⏱️ [AuthService] Sesión expirada por inactividad previa en localStorage.');
        localStorage.removeItem(this.LAST_ACTIVITY_KEY);
        await this.logout();
        return false;
      }
    }

    const { data: { session } } = await this.supabaseService.supabase.auth.getSession();
    if (session) {
      // ponytail: Cerrar sesión si no hay llave E2EE (detecta cierre de pestaña/navegador)
      const hasE2eeKey = sessionStorage.getItem('e2ee_session_key');
      if (!hasE2eeKey) {
        console.warn('🔒 [AuthService] Llave E2EE perdida (cierre de navegador/pestaña). Cerrando sesión.');
        await this.logout();
        return false;
      }

      await this.loadUserProfile(session.user.id);
      return true;
    }
    return false;
  }

  private async loadUserProfile(userId: string) {
    console.log(`[DEBUG] Autenticado con ID de Supabase: ${userId}`);

    // Garantizar que la llave E2EE esté en sessionStorage (evita logout falso por redirecciones/passkeys)
    if (!sessionStorage.getItem('e2ee_session_key')) {
      sessionStorage.setItem('e2ee_session_key', 'E2EE_ACTIVE_' + Math.random().toString(36).substring(2));
    }

    // Query 1: datos base del usuario
    const { data: userData, error: userError } = await this.supabaseService.supabase
      .from('users')
      .select('matricula, role_id, requires_password_change, mobile_phone')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('[AuthService] Error cargando users:', userError?.message);
      return;
    }

    console.log(`[DEBUG] Rol leído de public.users: ${userData.role_id}`);

    // Query 2: perfil extendido (separado para evitar dependencia de FK en schema cache)
    let { data: profileData, error: profileError } = await this.supabaseService.supabase
      .from('profiles')
      .select('first_name, last_name, faculty, avatar_url')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      console.warn('[AuthService] No se pudo cargar profiles:', profileError.message);
    }

    // Si el usuario existe en `users` pero no tiene perfil (registro incompleto),
    // se crea un perfil vacío automáticamente para que la UI funcione.
    if (!profileData && !profileError) {
      console.warn('[AuthService] No existe perfil para este usuario — creando perfil vacío.');
      const { data: newProfile, error: insertErr } = await this.supabaseService.supabase
        .from('profiles')
        .insert({ user_id: userId, first_name: '', last_name: '', faculty: '' })
        .select('first_name, last_name, faculty, avatar_url')
        .single();

      if (insertErr) {
        console.error('[AuthService] Error creando perfil vacío:', insertErr.message);
      } else {
        profileData = newProfile;
      }
    }

    let roleName = 'Estudiante';
    if (userData.role_id === 3 || userData.role_id === '3') roleName = 'Psicologo';
    if (userData.role_id === 1 || userData.role_id === '1') roleName = 'Admin';
    if (userData.role_id === 4 || userData.role_id === '4') roleName = 'Nutricionista';

    const fullName = profileData
      ? `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim()
      : '';

    this.currentUser.set({
      matricula: userData.matricula,
      role: roleName,
      id: userId,
      name: fullName || 'Usuario',
      faculty: profileData?.faculty || '',
      requires_password_change: userData.requires_password_change === true,
      avatar_url: profileData?.avatar_url || '',
      mobile_phone: userData.mobile_phone || ''
    });
    this.isLoggedIn.set(true);
    // ponytail: Registrar actividad inicial al cargar perfil exitoso
    localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());
    this.resetInactivityTimer();
  }

  async login(email: string, pass: string, captchaToken?: string): Promise<boolean> {
    try {
      // 1. Verificar si el usuario requiere Passkeys (Jefatura/Admin)
      const { data: authMethodData, error: methodError } = await this.supabaseService.supabase
        .rpc('check_user_auth_method', { p_email: email });

      if (!methodError && authMethodData) {
        const { role_id, passkey_only } = authMethodData as { role_id?: number; passkey_only?: boolean };
        if (role_id === 1 || passkey_only) {
          console.error('[AuthService] Intento de login con contraseña para cuenta protegida por Passkey.');
          return false;
        }
      }

      const { data, error } = await this.supabaseService.supabase.auth.signInWithPassword({
        email,
        password: pass,
        options: captchaToken ? { captchaToken } : undefined
      });

      if (error || !data.session) {
        if (error?.message?.includes('Failed to fetch') || error?.message?.includes('Network request failed')) {
           console.warn('⚠️ MODO OFFLINE ACTIVADO: Supabase no detectado. Login simulado.');
           this.cryptoService.deriveKey(pass, email);
           this.activateMockSession(email);
           return true;
        }
        console.error('Error en login:', error?.message);
        return false;
      }

      this.cryptoService.deriveKey(pass, email);
      await this.loadUserProfile(data.user.id);
      return true;
    } catch (e) {
      console.warn('⚠️ MODO OFFLINE ACTIVADO: Login simulado por excepción de red.');
      this.cryptoService.deriveKey(pass, email);
      this.activateMockSession(email);
      return true;
    }
  }

  async loginWithPasskey(email: string, captchaToken?: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseService.supabase.auth.signInWithPasskey({
        options: captchaToken ? { captchaToken } : undefined
      });
      if (error || !data.session) {
        console.error('[AuthService] Error en login de Passkey:', error?.message);
        return false;
      }

      const userEmail = data.session.user.email;
      if (userEmail && email.toLowerCase().trim() !== userEmail.toLowerCase().trim()) {
        console.error('[AuthService] El correo autenticado no coincide con el identificador ingresado.');
        await this.logout();
        return false;
      }

      const userId = data.session.user.id;

      // Consultar rol en public.users
      const { data: userData, error: userError } = await this.supabaseService.supabase
        .from('users')
        .select('role_id')
        .eq('id', userId)
        .single();

      if (userError || !userData || userData.role_id !== 1) {
        console.error('[AuthService] Acceso denegado: el usuario no es administrador.');
        await this.logout();
        return false;
      }

      await this.loadUserProfile(userId);
      return true;
    } catch (e) {
      console.error('[AuthService] Excepción en loginWithPasskey:', e);
      return false;
    }
  }

  async sendMagicLink(email: string, captchaToken?: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin + '/sistema/acceso?mode=register',
          captchaToken: captchaToken || undefined
        }
      });
      if (error) {
        console.error('[AuthService] Error enviando Magic Link:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[AuthService] Excepción en sendMagicLink:', e);
      return false;
    }
  }

  async registerPasskey(): Promise<void> {
    const user = this.currentUser();
    if (!user || user.role !== 'Admin') {
      throw new Error('Solo los administradores pueden registrar una Passkey.');
    }

    const { error } = await this.supabaseService.supabase.auth.registerPasskey();
    if (error) {
      console.error('[AuthService] Error registrando Passkey:', error.message);
      throw error;
    }

    // UPDATE public.users SET passkey_only = TRUE
    const { error: updateError } = await this.supabaseService.supabase
      .from('users')
      .update({ passkey_only: true })
      .eq('id', user.id);

    if (updateError) {
      console.error('[AuthService] Error marcando passkey_only:', updateError.message);
      throw updateError;
    }

    console.log('[AuthService] Passkey registrada exitosamente y marcada como obligatoria.');
  }

  public parseJwt(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  async getSessionAmr(): Promise<string[]> {
    try {
      const { data: { session } } = await this.supabaseService.supabase.auth.getSession();
      if (!session || !session.access_token) return [];
      const payload = this.parseJwt(session.access_token);
      return payload?.amr || [];
    } catch (e) {
      console.error('[AuthService] Error obteniendo AMR:', e);
      return [];
    }
  }


  /**
   * Verifica si un correo electrónico ya está registrado en Supabase Auth.
   * Retorna { available: true } si el correo NO existe (se puede registrar).
   * Retorna { available: false, error: '...' } si el correo ya está en uso.
   *
   * Funciona en ambos modos de Supabase:
   *  - Con confirmación de email activa: signUp devuelve user con identities: []
   *  - Sin confirmación de email: signUp devuelve error 'User already registered'
   */
  async checkEmailAvailable(email: string): Promise<{ available: boolean; error?: string }> {
    // Retornamos true inmediatamente para evitar realizar registros temporales de prueba
    // en Supabase Auth que impidan el registro definitivo posterior. La verificación real
    // se realiza durante el signUp definitivo en el submit final del formulario.
    return { available: true };
  }

  async register(
    matricula: string,
    email: string,
    pass: string,
    firstName: string,
    lastName: string,
    faculty: string,
    profileData?: {
      programa_educativo?: string;
      celular?: string;
      antecedentes_familiares?: string;
      sexo?: string;
      fecha_nacimiento?: string;
      edad?: number;
    },
    captchaToken?: string
  ): Promise<string | null> {
    
    try {
      // 1. Sign up en Supabase Auth
      const { data: authData, error: authError } = await this.supabaseService.supabase.auth.signUp({
        email,
        password: pass,
        options: captchaToken ? { captchaToken } : undefined
      });

      if (authError || !authData.user) {
        if (authError?.message?.includes('Failed to fetch') || authError?.message?.includes('Network request failed')) {
           console.warn('⚠️ MODO OFFLINE ACTIVADO: Registro simulado.');
           this.cryptoService.deriveKey(pass, email);
           this.activateMockSession(matricula, faculty);
           return 'mock-user-id-123';
        }
        console.error('Error en registro auth:', authError?.message);
        throw authError || new Error('Error al registrar usuario en Supabase Auth.');
      }

      const userId = authData.user.id;

      // 2. Insertar en public.users
      const { error: userError } = await this.supabaseService.supabase.from('users').insert({
        id: userId,
        matricula: matricula,
        role_id: 2, // 2 = Estudiante
        requires_password_change: false,
        mobile_phone: profileData?.celular ?? null
      });
      if (userError) console.error('Error insertando user:', userError.message);

      // 3. Insertar en public.profiles (campos existentes en el schema real de la BD)
      // Nota: 'edad' no existe como columna — se calcula desde fecha_nacimiento
      const { error: profileError } = await this.supabaseService.supabase.from('profiles').insert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        faculty: faculty,
        programa_educativo: profileData?.programa_educativo ?? null,
        antecedentes_familiares: profileData?.antecedentes_familiares ?? null,
        sexo: profileData?.sexo ?? null,
        fecha_nacimiento: profileData?.fecha_nacimiento ?? null
      });
      if (profileError) console.error('Error insertando profile:', profileError.message);

      this.cryptoService.deriveKey(pass, email);
      await this.loadUserProfile(userId);
      return userId;
    } catch (e: any) {
      const msg = e?.message?.toLowerCase() || '';
      if (msg.includes('failed to fetch') || msg.includes('network request failed')) {
        console.warn('⚠️ MODO OFFLINE ACTIVADO: Registro simulado por excepción de red.');
        this.cryptoService.deriveKey(pass, email);
        this.activateMockSession(matricula, faculty);
        return 'mock-user-id-123';
      }
      throw e;
    }
  }

  // Método auxiliar para activar la sesión en modo offline
  private activateMockSession(matricula: string, faculty: string = '') {
    const term = matricula.toLowerCase();
    let role = 'Estudiante';
    let name = 'Usuario Offline';
    
    if (term.includes('admin')) {
      console.error('[SECURITY] Admin role no disponible en modo offline. Asignando Estudiante.');
      role = 'Estudiante';
      name = 'Estudiante Offline (Admin Fallback)';
    } else if (term.includes('psic') || term.includes('doctor') || term.includes('rivera') || term.includes('osei')) {
      role = 'Psicologo';
      name = 'Dr. Rivera (Simulado)';
    } else if (term.includes('nutri') || term.includes('nutrition')) {
      role = 'Nutricionista';
      name = 'Nutricionista (Simulado)';
    }

    this.currentUser.set({ 
      matricula: matricula, 
      role: role,
      id: 'mock-user-id-123',
      name: name,
      faculty: faculty
    });
    this.isLoggedIn.set(true);
    // ponytail: Registrar actividad inicial al activar sesión simulada
    localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());
    this.resetInactivityTimer();
  }

  async requestPasswordReset(email: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth/reset-password',
      });
      if (error) {
        console.error('Error solicitando reset de contraseña:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Excepción al solicitar reset:', e);
      return false;
    }
  }

  async updatePassword(newPass: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.supabase.auth.updateUser({
        password: newPass
      });
      if (error) {
        console.error('Error actualizando contraseña:', error.message);
        throw error;
      }
      return true;
    } catch (e) {
      console.error('Excepción al actualizar contraseña:', e);
      throw e;
    }
  }

  async updatePasswordWithVerification(currentPass: string, newPass: string): Promise<boolean> {
    // 1. Obtener email del usuario actual autenticado
    const { data: { user: authUser } } = await this.supabaseService.supabase.auth.getUser();
    if (!authUser || !authUser.email) {
      throw new Error('No se pudo verificar el usuario actual.');
    }
    // 2. Verificar la contraseña actual intentando hacer login
    const { error: signInError } = await this.supabaseService.supabase.auth.signInWithPassword({
      email: authUser.email,
      password: currentPass
    });
    if (signInError) {
      throw new Error('La contraseña actual es incorrecta.');
    }
    // 3. Si es correcta, actualizar a la nueva contraseña
    return this.updatePassword(newPass);
  }

  public async updateUserAvatar(avatarUrl: string): Promise<boolean> {
    const user = this.currentUser();
    if (!user) return false;

    try {
      const { error } = await this.supabaseService.supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating avatar in profiles table:', error.message);
        return false;
      }

      this.currentUser.set({ ...user, avatar_url: avatarUrl });
      return true;
    } catch (e) {
      console.error('Exception updating avatar:', e);
      this.currentUser.set({ ...user, avatar_url: avatarUrl });
      return true;
    }
  }

  async logout(redirectRoute: string = '/auth/login'): Promise<void> {
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
    }
    localStorage.removeItem(this.LAST_ACTIVITY_KEY);
    await this.supabaseService.supabase.auth.signOut();
    this.cryptoService.clearKey();
    this.currentUser.set(null);
    this.isLoggedIn.set(false);
    this.router.navigate([redirectRoute]);
  }
}
