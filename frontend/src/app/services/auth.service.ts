import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, firstValueFrom } from 'rxjs';
import { CryptoService } from './crypto.service';
import { environment } from '../../environments/environment';

interface LoginResponse {
  encrypted_private_key: string;
  message?: string;
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
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private cryptoService: CryptoService
  ) {}

  async register(username: string, email: string, password: string, honeypot?: string): Promise<any> {
    // Generowanie pary kluczy RSA
    const { publicKey, privateKey } = await this.cryptoService.generateKeyPair();
    
    // Szyfrowanie klucza prywatnego hasłem użytkownika
    const encryptedPrivateKey = await this.cryptoService.encryptPrivateKey(privateKey, password);

    return firstValueFrom(this.http.post(`${this.apiUrl}/auth/register`, {
      username,
      email,
      password,
      public_key: publicKey,
      encrypted_private_key: encryptedPrivateKey,
      honeypot: honeypot
    }));
  }

  async login(email: string, password: string, totpCode?: string): Promise<LoginResponse> {
    const response = await firstValueFrom(this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, {
      email,
      password,
      totp_code: totpCode
    }));

    if (response) {
      if (response.encrypted_private_key) {
        try {
          const privateKey = await this.cryptoService.decryptPrivateKey(
            response.encrypted_private_key,
            password
          );
          
          const privateKeyExported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
          const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyExported)));
          sessionStorage.setItem('private_key', privateKeyBase64);
        } catch (error) {
          console.error('Failed to decrypt private key:', error);
        }
      }
      
      try {
        const user = await firstValueFrom(this.http.get<User>(`${this.apiUrl}/auth/me`));
        this.currentUserSubject.next(user);
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      }
    }

    return response!;
  }

  logout(): Observable<any> {
    const logoutRequest = this.http.post(`${this.apiUrl}/auth/logout`, {});
    
    logoutRequest.subscribe({
      complete: () => {
        sessionStorage.removeItem('private_key');
        this.currentUserSubject.next(null);
      },
      error: () => {
        sessionStorage.removeItem('private_key');
        this.currentUserSubject.next(null);
      }
    });
    
    return logoutRequest;
  }

  logoutAllSessions(): Observable<any> {
    const logoutAllRequest = this.http.post(`${this.apiUrl}/auth/logout-all`, {});

    logoutAllRequest.subscribe({
      complete: () => {
        sessionStorage.removeItem('private_key');
        this.currentUserSubject.next(null);
      },
      error: () => {
        sessionStorage.removeItem('private_key');
        this.currentUserSubject.next(null);
      }
    });

    return logoutAllRequest;
  }

  async checkAuth(): Promise<boolean> {
    try {
      const user = await firstValueFrom(this.http.get<User>(`${this.apiUrl}/auth/me`));
      this.currentUserSubject.next(user);
      return true;
    } catch (error: any) {
      if (error?.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          try {
            const user = await firstValueFrom(this.http.get<User>(`${this.apiUrl}/auth/me`));
            this.currentUserSubject.next(user);
            return true;
          } catch {
            this.currentUserSubject.next(null);
            return false;
          }
        }
      }
      this.currentUserSubject.next(null);
      return false;
    }
  }

  async getPrivateKey(): Promise<CryptoKey | null> {
    const privateKeyBase64 = sessionStorage.getItem('private_key');
    if (!privateKeyBase64) {
      return null;
    }

    try {
      // Konwersja base64 na CryptoKey
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

  async refreshToken(): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post<{message: string}>(
        `${this.apiUrl}/auth/refresh-token`,
        {}
      ));
      return true;
    } catch (error: any) {
      return false;
    }
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  async getCurrentUserPublicKey(): Promise<string | null> {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) {
      return null;
    }

    try {
      const response = await firstValueFrom(this.http.get<any>(`${this.apiUrl}/users/${currentUser.id}`));
      return response?.public_key || null;
    } catch {
      return null;
    }
  }

  async unlockPrivateKey(password: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(this.http.post<{encrypted_private_key: string}>(
        `${this.apiUrl}/auth/get-private-key`,
        { password }
      ));

      if (response?.encrypted_private_key) {
        const privateKey = await this.cryptoService.decryptPrivateKey(
          response.encrypted_private_key,
          password
        );

        const privateKeyExported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
        const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyExported)));
        sessionStorage.setItem('private_key', privateKeyBase64);
        
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  hasPrivateKey(): boolean {
    return sessionStorage.getItem('private_key') !== null;
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
      title.textContent = 'Weryfikacja tożsamości';
      title.style.cssText = 'margin-top: 0; color: #333;';

      const description = document.createElement('p');
      description.textContent = 'Podaj hasło aby kontynuować:';
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

  requestPasswordReset(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/request-password-reset`, { email });
  }

  resetPassword(token: string, newPassword: string, publicKey: string, encryptedPrivateKey: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reset-password`, {
      token,
      new_password: newPassword,
      public_key: publicKey,
      encrypted_private_key: encryptedPrivateKey
    });
  }
}
