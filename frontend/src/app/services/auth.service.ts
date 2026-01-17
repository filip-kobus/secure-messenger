import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, firstValueFrom } from 'rxjs';
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
  private currentUser: User | null = null;

  constructor(
    private http: HttpClient,
    private cryptoService: CryptoService
  ) {}

  async register(username: string, email: string, password: string): Promise<any> {
    // Generowanie pary kluczy RSA
    const { publicKey, privateKey } = await this.cryptoService.generateKeyPair();
    
    // Szyfrowanie klucza prywatnego hasłem użytkownika
    const encryptedPrivateKey = await this.cryptoService.encryptPrivateKey(privateKey, password);

    return firstValueFrom(this.http.post(`${this.apiUrl}/auth/register`, {
      username,
      email,
      password,
      public_key: publicKey,
      encrypted_private_key: encryptedPrivateKey
    }));
  }

  async login(email: string, password: string, totpCode?: string): Promise<LoginResponse> {
    const response = await firstValueFrom(this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, {
      email,
      password,
      totp_code: totpCode
    }));

    if (response) {
      // Zapisz tokeny
      sessionStorage.setItem('secure_messenger_access_token', response.access_token);
      localStorage.setItem('secure_messenger_refresh_token', response.refresh_token);  // localStorage - persistentny
      
      if (response.encrypted_private_key) {
        // Odszyfrowanie klucza prywatnego
        const privateKey = await this.cryptoService.decryptPrivateKey(
          response.encrypted_private_key,
          password
        );
        
        // Zapisanie klucza prywatnego w sessionStorage
        const privateKeyExported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
        const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyExported)));
        sessionStorage.setItem('secure_messenger_private_key', privateKeyBase64);
      }
      
      // Pobierz dane użytkownika
      this.currentUser = await firstValueFrom(this.http.get<User>(`${this.apiUrl}/auth/me`));
    }

    return response!;
  }

  logout(): Observable<any> {
    sessionStorage.removeItem('secure_messenger_access_token');
    localStorage.removeItem('secure_messenger_refresh_token');
    sessionStorage.removeItem('secure_messenger_private_key');
    this.currentUser = null;
    
    // Logout teraz wymaga JWT tokena (nie refresh_token w query)
    return this.http.post(`${this.apiUrl}/auth/logout`, {});
  }

  async checkAuth(): Promise<boolean> {
    try {
      if (!this.getToken() && this.getRefreshToken()) {
        const refreshed = await this.refreshToken();
        if (!refreshed) {
          this.currentUser = null;
          return false;
        }
      }

      // Sprawdź czy token jest ważny
      if (this.getToken()) {
        this.currentUser = await firstValueFrom(this.http.get<User>(`${this.apiUrl}/auth/me`));
        return true;
      }

      this.currentUser = null;
      return false;
    } catch {
      this.currentUser = null;
      return false;
    }
  }

  async getPrivateKey(): Promise<CryptoKey | null> {
    const privateKeyBase64 = sessionStorage.getItem('secure_messenger_private_key');
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
    return this.currentUser !== null && this.getToken() !== null;
  }

  getToken(): string | null {
    return sessionStorage.getItem('secure_messenger_access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('secure_messenger_refresh_token');
  }

  async refreshToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await firstValueFrom(this.http.post<{access_token: string, token_type: string}>(
        `${this.apiUrl}/auth/refresh-token?refresh_token=${refreshToken}`,
        {}
      ));

      if (response?.access_token) {
        sessionStorage.setItem('secure_messenger_access_token', response.access_token);
        return true;
      }
      return false;
    } catch (error: any) {
      // Token wygasł - usuń
      if (error?.status === 401 || error?.status === 403) {
        localStorage.removeItem('secure_messenger_refresh_token');
      }
      return false;
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  async getCurrentUserPublicKey(): Promise<string | null> {
    if (!this.currentUser) {
      return null;
    }

    try {
      const response = await firstValueFrom(this.http.get<any>(`${this.apiUrl}/users/${this.currentUser.id}`));
      return response?.public_key || null;
    } catch {
      return null;
    }
  }

  async unlockPrivateKey(password: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(this.http.post<{encrypted_private_key: string}>(
        `${this.apiUrl}/auth/unlock-private-key?password=${password}`,
        {}
      ));

      if (response?.encrypted_private_key) {
        // Odszyfruj klucz prywatny
        const privateKey = await this.cryptoService.decryptPrivateKey(
          response.encrypted_private_key,
          password
        );

        // Zapisz w sessionStorage
        const privateKeyExported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
        const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyExported)));
        sessionStorage.setItem('secure_messenger_private_key', privateKeyBase64);
        
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  hasPrivateKey(): boolean {
    return sessionStorage.getItem('secure_messenger_private_key') !== null;
  }

  // Wyświetl modal z prośbą o hasło
  promptForPassword(): Promise<string | null> {
    return new Promise((resolve) => {
      // Stwórz modal
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 8px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      `;

      const title = document.createElement('h3');
      title.textContent = 'Odblokuj wiadomość';
      title.style.cssText = 'margin-top: 0; color: #333;';

      const description = document.createElement('p');
      description.textContent = 'Podaj hasło aby odszyfrować wiadomość:';
      description.style.cssText = 'color: #666; margin-bottom: 20px;';

      const input = document.createElement('input');
      input.type = 'password';
      input.placeholder = 'Hasło';
      input.style.cssText = `
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-sizing: border-box;
        font-size: 14px;
        margin-bottom: 10px;
      `;

      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'color: red; font-size: 14px; margin-bottom: 10px; min-height: 20px;';

      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'display: flex; gap: 10px;';

      const submitButton = document.createElement('button');
      submitButton.textContent = 'Odblokuj';
      submitButton.style.cssText = `
        flex: 1;
        padding: 10px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      `;

      const cancelButton = document.createElement('button');
      cancelButton.textContent = 'Anuluj';
      cancelButton.style.cssText = `
        flex: 1;
        padding: 10px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      `;

      const cleanup = () => {
        document.body.removeChild(modal);
      };

      submitButton.onclick = () => {
        const password = input.value;
        if (!password) {
          errorDiv.textContent = 'Hasło jest wymagane';
          return;
        }
        cleanup();
        resolve(password);
      };

      submitButton.onmouseover = () => {
        submitButton.style.background = '#0056b3';
      };
      submitButton.onmouseout = () => {
        submitButton.style.background = '#007bff';
      };

      cancelButton.onclick = () => {
        cleanup();
        resolve(null);
      };

      cancelButton.onmouseover = () => {
        cancelButton.style.background = '#5a6268';
      };
      cancelButton.onmouseout = () => {
        cancelButton.style.background = '#6c757d';
      };

      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          submitButton.click();
        } else if (e.key === 'Escape') {
          cancelButton.click();
        }
      };

      buttonContainer.appendChild(submitButton);
      buttonContainer.appendChild(cancelButton);

      modalContent.appendChild(title);
      modalContent.appendChild(description);
      modalContent.appendChild(input);
      modalContent.appendChild(errorDiv);
      modalContent.appendChild(buttonContainer);

      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      // Focus na input
      setTimeout(() => input.focus(), 100);
    });
  }
}
