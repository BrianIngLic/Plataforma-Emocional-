import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { CryptoService } from './crypto.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public currentUser = signal<{ matricula: string, role: string, id: string, name: string, faculty?: string, requires_password_change?: boolean } | null>(null);
  public isLoggedIn = signal<boolean>(false);

  constructor(
    private supabaseService: SupabaseService,
    private cryptoService: CryptoService,
    private router: Router
  ) {
    this.checkSession();
  }

  public async checkSession(): Promise<boolean> {
    if (this.isLoggedIn()) return true;

    const { data: { session } } = await this.supabaseService.supabase.auth.getSession();
    if (session) {
      await this.loadUserProfile(session.user.id);
      return true;
    }
    return false;
  }

  private async loadUserProfile(userId: string) {
    console.log(`[DEBUG] Autenticado con ID de Supabase: ${userId}`);
    
    let { data, error } = await this.supabaseService.supabase
      .from('users')
      .select('matricula, role_id, requires_password_change, profiles(first_name, last_name, faculty)')
      .eq('id', userId)
      .single();

    if (data) {
      console.log(`[DEBUG] Rol leído de public.users: ${data.role_id}`);
    }

    // Fallback: si falla por la columna faculty (que aún no se crea en BD), intentar sin ella
    if (error && (error.message.includes('faculty') || error.code === 'PGRST200')) {
      const fallback = await this.supabaseService.supabase
        .from('users')
        .select('matricula, role_id, profiles(first_name, last_name)')
        .eq('id', userId)
        .single();
      data = fallback.data as any;
      error = fallback.error;
    }

    if (data) {
      let roleName = 'Estudiante';
      if (data.role_id === 3 || data.role_id === '3') roleName = 'Psicologo';
      if (data.role_id === 1 || data.role_id === '1') roleName = 'Admin';

      let fullName = 'Usuario';
      let facultyName = '';
      if (data.profiles) {
        // @ts-ignore
        const p = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
        if (p) {
          fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
          facultyName = p.faculty || '';
        }
      }

      this.currentUser.set({ 
        matricula: data.matricula, 
        role: roleName,
        id: userId,
        name: fullName || 'Usuario',
        faculty: facultyName,
        requires_password_change: data.requires_password_change === true
      });
      this.isLoggedIn.set(true);
    } else if (error) {
      console.error('Error loading user profile:', error.message);
    }
  }

  async login(email: string, pass: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseService.supabase.auth.signInWithPassword({
        email,
        password: pass
      });

      if (error || !data.session) {
        if (error?.message?.includes('Failed to fetch') || error?.message?.includes('Network request failed')) {
           console.warn('⚠️ MODO OFFLINE ACTIVADO: Supabase no detectado. Login simulado.');
           this.activateMockSession(email);
           return true;
        }
        console.error('Error en login:', error?.message);
        return false;
      }

      await this.loadUserProfile(data.user.id);
      return true;
    } catch (e) {
      console.warn('⚠️ MODO OFFLINE ACTIVADO: Login simulado por excepción de red.');
      this.activateMockSession(email);
      return true;
    }
  }

  async register(matricula: string, email: string, pass: string, firstName: string, lastName: string, faculty: string): Promise<string | null> {
    
    try {
      // 1. Sign up en Supabase Auth
      const { data: authData, error: authError } = await this.supabaseService.supabase.auth.signUp({
        email,
        password: pass
      });

      if (authError || !authData.user) {
        if (authError?.message?.includes('Failed to fetch') || authError?.message?.includes('Network request failed')) {
           console.warn('⚠️ MODO OFFLINE ACTIVADO: Supabase no detectado. Registro simulado.');
           this.activateMockSession(matricula, faculty);
           return 'mock-user-id-123';
        }
        console.error('Error en registro auth:', authError?.message);
        return null;
      }

      const userId = authData.user.id;

    // 2. Insertar en public.users
    const { error: userError } = await this.supabaseService.supabase.from('users').insert({
      id: userId,
      matricula: matricula,
      role_id: 2, // Asumiendo que 2 es 'Estudiante'
      requires_password_change: false
    });
    if (userError) console.error('Error insertando user:', userError.message);

    // 3. Insertar en public.profiles
    const { error: profileError } = await this.supabaseService.supabase.from('profiles').insert({
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      faculty: faculty
    });
    if (profileError) console.error('Error insertando profile:', profileError.message);

      await this.loadUserProfile(userId);
      return userId;
    } catch (e) {
      console.warn('⚠️ MODO OFFLINE ACTIVADO: Registro simulado por excepción de red.');
      this.activateMockSession(matricula, faculty);
      return 'mock-user-id-123';
    }
  }

  // Método auxiliar para activar la sesión en modo offline
  private activateMockSession(matricula: string, faculty: string = '') {
    const term = matricula.toLowerCase();
    let role = 'Estudiante';
    let name = 'Usuario Offline';
    
    if (term.includes('admin')) {
      role = 'Admin';
      name = 'Administrador de Sistema';
    } else if (term.includes('psic') || term.includes('doctor') || term.includes('rivera') || term.includes('osei')) {
      role = 'Psicologo';
      name = 'Dr. Rivera (Simulado)';
    }

    this.currentUser.set({ 
      matricula: matricula, 
      role: role,
      id: 'mock-user-id-123',
      name: name,
      faculty: faculty

    });
    this.isLoggedIn.set(true);
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
        return false;
      }
      return true;
    } catch (e) {
      console.error('Excepción al actualizar contraseña:', e);
      return false;
    }
  }

  async logout(): Promise<void> {
    await this.supabaseService.supabase.auth.signOut();
    this.currentUser.set(null);
    this.isLoggedIn.set(false);
    this.router.navigate(['/auth/login']);
  }
}
