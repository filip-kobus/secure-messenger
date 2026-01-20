import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  
  private get crypto(): SubtleCrypto {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Crypto API is not available. Please use HTTPS or localhost.');
    }
    return window.crypto.subtle;
  }

  // Generowanie pary kluczy RSA 2048-bit
  async generateKeyPair(): Promise<{ publicKey: string; privateKey: CryptoKey }> {
    const keyPair = await this.crypto.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    );

    const publicKeyExported = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyPEM = this.arrayBufferToPEM(publicKeyExported, 'PUBLIC KEY');

    return {
      publicKey: publicKeyPEM,
      privateKey: keyPair.privateKey
    };
  }

  // Szyfrowanie klucza prywatnego hasłem użytkownika (używając klucza wyprowadzonego z hasła)
  async encryptPrivateKey(privateKey: CryptoKey, password: string): Promise<string> {
    const privateKeyExported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
    
    // Wyprowadzenie klucza z hasła za pomocą PBKDF2
    const encoder = new TextEncoder();
    const passwordKey = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      derivedKey,
      privateKeyExported
    );

    // Połączenie: salt (16) + iv (12) + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  // Deszyfrowanie klucza prywatnego hasłem użytkownika
  async decryptPrivateKey(encryptedPrivateKey: string, password: string): Promise<CryptoKey> {
    const combined = Uint8Array.from(atob(encryptedPrivateKey), c => c.charCodeAt(0));
    
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encryptedData = combined.slice(28);

    const encoder = new TextEncoder();
    const passwordKey = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      derivedKey,
      encryptedData
    );

    return await window.crypto.subtle.importKey(
      'pkcs8',
      decrypted,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      true,
      ['decrypt']
    );
  }

  // Generowanie klucza symetrycznego AES-256
  async generateSymmetricKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Szyfrowanie wiadomości kluczem symetrycznym
  async encryptMessage(message: string, symmetricKey: CryptoKey): Promise<{ encrypted: string }> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      symmetricKey,
      data
    );

    // Połącz iv (12 bytes) + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return {
      encrypted: btoa(String.fromCharCode(...combined))
    };
  }

  // Deszyfrowanie wiadomości kluczem symetrycznym
  async decryptMessage(encryptedMessage: string, symmetricKey: CryptoKey): Promise<string> {
    const combined = Uint8Array.from(atob(encryptedMessage), c => c.charCodeAt(0));
    
    // Pierwsze 12 bytes to iv, reszta to zaszyfrowane dane
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      symmetricKey,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  // Szyfrowanie klucza symetrycznego kluczem publicznym RSA odbiorcy
  async encryptSymmetricKey(symmetricKey: CryptoKey, publicKeyPEM: string): Promise<string> {
    const publicKey = await this.importPublicKey(publicKeyPEM);
    const symmetricKeyExported = await window.crypto.subtle.exportKey('raw', symmetricKey);
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      symmetricKeyExported
    );

    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  }

  // Deszyfrowanie klucza symetrycznego kluczem prywatnym RSA
  async decryptSymmetricKey(encryptedSymmetricKey: string, privateKey: CryptoKey): Promise<CryptoKey> {
    const encrypted = Uint8Array.from(atob(encryptedSymmetricKey), c => c.charCodeAt(0));
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      encrypted
    );

    return await window.crypto.subtle.importKey(
      'raw',
      decrypted,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Generowanie podpisu RSA-PSS
  async signMessage(message: string, privateKey: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    
    // Najpierw trzeba zaimportować klucz jako signing key
    const privateKeyExported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
    const signingKey = await window.crypto.subtle.importKey(
      'pkcs8',
      privateKeyExported,
      {
        name: 'RSA-PSS',
        hash: 'SHA-256'
      },
      true,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign(
      {
        name: 'RSA-PSS',
        saltLength: 32
      },
      signingKey,
      data
    );

    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  // Weryfikacja podpisu RSA-PSS
  async verifySignature(message: string, signature: string, publicKeyPEM: string): Promise<boolean> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const signatureArray = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
      
      const publicKey = await this.importPublicKeyForVerification(publicKeyPEM);
      
      return await window.crypto.subtle.verify(
        {
          name: 'RSA-PSS',
          saltLength: 32
        },
        publicKey,
        signatureArray,
        data
      );
    } catch (e) {
      return false;
    }
  }

  // Szyfrowanie załącznika
  async encryptAttachment(file: File, symmetricKey: CryptoKey): Promise<{ encrypted: string }> {
    const arrayBuffer = await file.arrayBuffer();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      symmetricKey,
      arrayBuffer
    );

    // Połącz iv (12 bytes) + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Konwersja na base64 bez spread operator (unika stack overflow dla dużych plików)
    let binary = '';
    for (let i = 0; i < combined.length; i++) {
      binary += String.fromCharCode(combined[i]);
    }

    return {
      encrypted: btoa(binary)
    };
  }

  // Deszyfrowanie załącznika
  async decryptAttachment(encryptedData: string, symmetricKey: CryptoKey): Promise<ArrayBuffer> {
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Pierwsze 12 bytes to iv, reszta to zaszyfrowane dane
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    return await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      symmetricKey,
      encrypted
    );
  }

  // Pomocnicze metody
  private arrayBufferToPEM(buffer: ArrayBuffer, label: string): string {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const formatted = base64.match(/.{1,64}/g)?.join('\n') || base64;
    return `-----BEGIN ${label}-----\n${formatted}\n-----END ${label}-----`;
  }

  private async importPublicKey(pem: string): Promise<CryptoKey> {
    const pemContents = pem
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s/g, '');
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    return await window.crypto.subtle.importKey(
      'spki',
      binaryDer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      true,
      ['encrypt']
    );
  }

  private async importPublicKeyForVerification(pem: string): Promise<CryptoKey> {
    const pemContents = pem
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s/g, '');
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    return await window.crypto.subtle.importKey(
      'spki',
      binaryDer,
      {
        name: 'RSA-PSS',
        hash: 'SHA-256'
      },
      true,
      ['verify']
    );
  }
}
