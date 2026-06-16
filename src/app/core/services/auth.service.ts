import { Injectable, signal } from '@angular/core';

/**
 * Servicio de Autenticación Principal (Mocks Temporales).
 * Gestiona el estado reactivo usando Angular 18 Signals.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Estado global reactivo
  public currentUser = signal<{ matricula: string, role: string } | null>(null);
  public isLoggedIn = signal<boolean>(false);

  constructor() {}

  /**
   * Simula un inicio de sesión contra PostgREST.
   * @param matricula Número de control del usuario
   * @param pass Contraseña
   */
  login(matricula: string, pass: string): boolean {
    if (matricula && pass) {
      // Mock de éxito
      this.currentUser.set({ matricula, role: 'Estudiante' });
      this.isLoggedIn.set(true);
      // Simular guardado de token JWT
      localStorage.setItem('jwt_token', 'mock_jwt_token_123');
      return true;
    }
    return false;
  }

  /**
   * Cierra sesión destruyendo el signal local y localStorage.
   */
  logout(): void {
    this.currentUser.set(null);
    this.isLoggedIn.set(false);
    localStorage.removeItem('jwt_token');
  }

  /**
   * Obtiene el JWT almacenado.
   */
  getToken(): string | null {
    return localStorage.getItem('jwt_token');
  }
}
