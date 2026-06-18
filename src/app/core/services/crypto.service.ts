import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  // Utilizamos la llave proveída por el usuario (1234) para cifrar los datos 
  // antes de enviarlos a Supabase, asegurando Privacidad Zero-Knowledge.
  private secretKey = environment.encryptionKey;

  /**
   * Cifra un texto plano devolviendo un hash en Base64.
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return '';
    return CryptoJS.AES.encrypt(plaintext, this.secretKey).toString();
  }

  /**
   * Descifra un hash en Base64 devolviendo el texto plano.
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext) return '';
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, this.secretKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
      console.error('Error al descifrar el mensaje', e);
      return 'Mensaje corrupto o llave incorrecta';
    }
  }
}
