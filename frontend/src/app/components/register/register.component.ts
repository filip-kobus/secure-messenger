import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="container">
      <h1>Rejestracja</h1>
      
      <form (ngSubmit)="onSubmit()" #registerForm="ngForm">
        <div class="form-group">
          <label for="username">Nazwa użytkownika:</label>
          <input 
            type="text" 
            id="username" 
            name="username"
            [(ngModel)]="username" 
            required 
            minlength="3">
        </div>

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
            required 
            minlength="8">
          <small>Minimum 8 znaków, wielka litera, cyfra, znak specjalny</small>
        </div>

        <div class="form-group">
          <label for="confirmPassword">Potwierdź hasło:</label>
          <input 
            type="password" 
            id="confirmPassword" 
            name="confirmPassword"
            [(ngModel)]="confirmPassword" 
            required>
        </div>

        <div class="error" *ngIf="error">{{ error }}</div>
        <div class="success" *ngIf="success">{{ success }}</div>

        <button 
          type="submit" 
          [disabled]="!registerForm.valid || loading">
          {{ loading ? 'Rejestracja...' : 'Zarejestruj się' }}
        </button>
      </form>

      <p>
        Masz już konto? <a routerLink="/login">Zaloguj się</a>
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

    small {
      display: block;
      margin-top: 5px;
      color: #666;
      font-size: 12px;
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

    .success {
      color: green;
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
export class RegisterComponent implements OnInit {
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  error = '';
  success = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Jeśli użytkownik jest już zalogowany, przekieruj do wiadomości
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/messages']);
    }
  }

  async onSubmit() {
    this.error = '';
    this.success = '';

    if (this.password !== this.confirmPassword) {
      this.error = 'Hasła nie są identyczne';
      return;
    }

    if (this.password.length < 8) {
      this.error = 'Hasło musi mieć co najmniej 8 znaków';
      return;
    }

    this.loading = true;

    try {
      await this.authService.register(this.username, this.email, this.password);
      this.success = 'Rejestracja zakończona pomyślnie! Przekierowanie...';
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
    } catch (err: any) {
      this.error = err.error?.detail || 'Błąd rejestracji';
      this.loading = false;
    }
  }
}
