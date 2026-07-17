import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private derivedKey: string | null = null;
  private readonly legacyPepper = 'b450c18d9f4a72d3e51f8b64a2c901e7';

  deriveKey(password: string, salt: string): void {
    if (!password || !salt) return;
    // Derivación de la llave simétrica para descifrar datos históricos E2EE
    const combinedSalt = salt + this.legacyPepper;
    const key = CryptoJS.PBKDF2(password, combinedSalt, { keySize: 256 / 32, iterations: 10000 }).toString();
    this.derivedKey = key;
    sessionStorage.setItem('e2ee_session_key', key);
    console.log('🔒 [CryptoService] Llave de descifrado histórico derivada en memoria.');
  }

  clearKey(): void {
    this.derivedKey = null;
    sessionStorage.removeItem('e2ee_session_key');
    console.log('🧹 [CryptoService] Llave de descifrado histórico purgada.');
  }

  private getKey(): string {
    if (this.derivedKey) return this.derivedKey;
    const stored = sessionStorage.getItem('e2ee_session_key');
    if (stored) {
      this.derivedKey = stored;
      return stored;
    }
    return this.legacyPepper;
  }

  encrypt(plaintext: string): string {
    // Caso B: No cifrar en cliente, enviar en texto plano para que el servidor lo cifre
    return plaintext || '';
  }

  decrypt(ciphertext: string, extraKeys: string[] = []): string {
    if (!ciphertext) return '';

    // Si no empieza con el prefijo típico de CryptoJS (U2FsdGVkX1),
    // significa que ya fue descifrado por el servidor y viene en texto plano.
    if (!ciphertext.startsWith('U2FsdGVkX1')) {
      return ciphertext;
    }

    const keysToTry: string[] = [];
    const activeKey = this.getKey();
    keysToTry.push(activeKey);

    if (this.legacyPepper !== activeKey) {
      keysToTry.push(this.legacyPepper);
    }

    if (extraKeys && extraKeys.length > 0) {
      keysToTry.push(...extraKeys);
    }
    keysToTry.push('patient', 'paciente', 'student', 'estudiante', 'psychologist', 'psicologo', 'nutritionist', 'nutriologo');

    for (const key of keysToTry) {
      try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, key);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (decrypted) {
          return decrypted;
        }
      } catch (e) {
        // Probar siguiente clave
      }
    }

    // Fallback para contraseñas de prueba
    try {
      const combinedSalt = 'patient' + this.legacyPepper;
      const derivedTestKey = CryptoJS.PBKDF2('patient', combinedSalt, { keySize: 256 / 32, iterations: 10000 }).toString();
      const bytes = CryptoJS.AES.decrypt(ciphertext, derivedTestKey);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (decrypted) {
        return decrypted;
      }
    } catch (e) {}

    return ciphertext;
  }
}
