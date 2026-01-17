import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CryptoService } from './crypto.service';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  encrypted_private_key?: string;
}

interface User {
  id: number;
  username: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8000';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private cryptoService: CryptoService
  ) {
    this.checkAuth();
  }

  async register(username: string, email: string, password: string): Promise<any> {
    // Generowanie pary kluczy RSA
    const { publicKey, privateKey } = await this.cryptoService.generateKeyPair();
    
    // Szyfrowanie klucza prywatnego hasłem użytkownika
    const encryptedPrivateKey = await this.cryptoService.encryptPrivateKey(privateKey, password);

    return this.http.post(`${this.apiUrl}/auth/register`, {
      username,
      email,
      password,
      public_key: publicKey,
      encrypted_private_key: encryptedPrivateKey
    }).toPromise();
  }

  async login(email: string, password: string, totpCode?: string): Promise<LoginResponse> {
    const response = await this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, {
      email,
      password,
      totp_code: totpCode
    }).toPromise();

    if (response) {
      // Zapisz tokeny
      sessionStorage.setItem('access_token', response.access_token);
      sessionStorage.setItem('refresh_token', response.refresh_token);
      
      if (response.encrypted_private_key) {
        // Odszyfrowanie klucza prywatnego
        const privateKey = await this.cryptoService.decryptPrivateKey(
          response.encrypted_private_key,
          password
        );
        
        // Zapisanie klucza prywatnego w sessionStorage
        const privateKeyExported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
        const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyExported)));
        sessionStorage.setItem('privateKey', privateKeyBase64);
      }
      
      await this.checkAuth();
    }

    return response!;
  }

  logout(): Observable<any> {
    const refreshToken = sessionStorage.getItem('refresh_token');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('privateKey');
    this.currentUserSubject.next(null);
    
    if (refreshToken) {
      return this.http.post(`${this.apiUrl}/auth/logout?refresh_token=${refreshToken}`, {});
    }
    return this.http.post(`${this.apiUrl}/auth/logout`, {});
  }

  async checkAuth(): Promise<void> {
    try {
      const user = await this.http.get<User>(`${this.apiUrl}/auth/me`).toPromise();
      this.currentUserSubject.next(user || null);
    } catch {
      this.currentUserSubject.next(null);
    }
  }

  async getPrivateKey(): Promise<CryptoKey | null> {
    const privateKeyBase64 = sessionStorage.getItem('privateKey');
    if (!privateKeyBase64) {
      return null;
    }

    try {
      const privateKeyArray = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));
      return await window.crypto.subtle.importKey(
        'pkcs8',
        privateKeyArray,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256'
        },
        true,
        ['decrypt']
      );
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  getToken(): string | null {
    return sessionStorage.getItem('access_token');
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  async getCurrentUserPublicKey(): Promise<string | null> {
    const user = this.currentUserSubject.value;
    if (!user) {
      return null;
    }

    try {
      const response = await this.http.get<any>(`${this.apiUrl}/users/${user.id}`).toPromise();
      return response?.public_key || null;
    } catch {
      return null;
    }
  }
}
