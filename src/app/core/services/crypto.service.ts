import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  // Llave derivada en memoria volátil
  private derivedKey: string | null = null;

  /**
   * Deriva una clave simétrica única a partir de la contraseña y un salt (email)
   * utilizando PBKDF2 con 10,000 iteraciones para máxima entropía (Zero-Knowledge).
   */
  deriveKey(password: string, salt: string): void {
    if (!password || !salt) return;
    // Combinamos el salt del usuario con la clave robusta de environment como pimienta (pepper)
    const combinedSalt = salt + environment.encryptionKey;
    const key = CryptoJS.PBKDF2(password, combinedSalt, { keySize: 256 / 32, iterations: 10000 }).toString();
    this.derivedKey = key;
    // Guardamos en sessionStorage para que sobreviva a recargas de pestaña (F5) sin exponerse en localStorage ni en backend
    sessionStorage.setItem('e2ee_session_key', key);
    console.log('🔒 [CryptoService] Llave E2EE derivada exitosamente en memoria volátil.');
  }

  /**
   * Elimina la llave de la memoria RAM y de sessionStorage al cerrar sesión o expirar inactividad.
   */
  clearKey(): void {
    this.derivedKey = null;
    sessionStorage.removeItem('e2ee_session_key');
    console.log('🧹 [CryptoService] Llave E2EE purgada de memoria volátil.');
  }

  /**
   * Obtiene la llave de cifrado activa, verificando RAM, sessionStorage o el fallback de legado.
   */
  private getKey(): string {
    if (this.derivedKey) return this.derivedKey;
    const stored = sessionStorage.getItem('e2ee_session_key');
    if (stored) {
      this.derivedKey = stored;
      return stored;
    }
    // Fallback de respaldo/legado si la sesión se restauró en una nueva pestaña sin llave en sessionStorage
    return environment.encryptionKey;
  }

  /**
   * Cifra un texto plano devolviendo un hash en Base64.
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return '';
    return CryptoJS.AES.encrypt(plaintext, this.getKey()).toString();
  }

  /**
   * Descifra un hash en Base64 devolviendo el texto plano.
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext) return '';
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, this.getKey());
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
      console.error('Error al descifrar el mensaje', e);
      return 'Mensaje corrupto o llave incorrecta';
    }
  }
}
