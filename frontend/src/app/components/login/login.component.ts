import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="container">
      <h1>Logowanie</h1>
      
      <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
        <div class="form-group">
          <label for="email">Email:</label>
          <input 
            type="email" 
            id="email" 
            name="email"
            [(ngModel)]="email" 
            required>
        </div>

        <div class="form-group">
          <label for="password">Hasło:</label>
          <input 
            type="password" 
            id="password" 
            name="password"
            [(ngModel)]="password" 
            required>
        </div>

        <div class="form-group" *ngIf="requires2FA">
          <label for="totpCode">Kod 2FA:</label>
          <input 
            type="text" 
            id="totpCode" 
            name="totpCode"
            [(ngModel)]="totpCode" 
            required
            maxlength="6"
            placeholder="123456">
        </div>

        <div class="error" *ngIf="error">{{ error }}</div>

        <button 
          type="submit" 
          [disabled]="!loginForm.valid || loading">
          {{ loading ? 'Logowanie...' : 'Zaloguj się' }}
        </button>
      </form>

      <p>
        Nie masz konta? <a routerLink="/register">Zarejestruj się</a>
      </p>
    </div>
  `,
  styles: [`
    .container {
      max-width: 400px;
      margin: 50px auto;
      padding: 20px;
    }

    .form-group {
      margin-bottom: 15px;
    }

    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }

    input {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-sizing: border-box;
    }

    button {
      width: 100%;
      padding: 10px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }

    button:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }

    button:hover:not(:disabled) {
      background-color: #0056b3;
    }

    .error {
      color: red;
      margin-bottom: 15px;
    }

    p {
      text-align: center;
      margin-top: 20px;
    }

    a {
      color: #007bff;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  totpCode = '';
  requires2FA = false;
  error = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async onSubmit() {
    this.error = '';
    this.loading = true;

    try {
      const response = await this.authService.login(
        this.email, 
        this.password, 
        this.totpCode || undefined
      );

      if (response) {
        this.router.navigate(['/messages']);
      }
    } catch (err: any) {
      // Jeśli błąd 403 i zawiera "2FA", pokaż pole TOTP
      if (err.status === 403 && err.error?.detail?.includes('2FA')) {
        this.requires2FA = true;
        this.error = 'Wprowadź kod 2FA';
      } else {
        this.error = err.error?.detail || 'Błąd logowania';
      }
      this.loading = false;
    }
  }
}
