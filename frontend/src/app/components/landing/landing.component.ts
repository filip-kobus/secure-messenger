import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="landing">
      <div class="hero">
        <h1>🔒 Secure Messenger</h1>
        <p class="tagline">Bezpieczna komunikacja z szyfrowaniem end-to-end</p>
        
        <div class="features">
          <div class="feature">
            <span class="icon">🔐</span>
            <h3>Pełne szyfrowanie</h3>
            <p>Wiadomości szyfrowane RSA-2048 + AES-256-GCM</p>
          </div>
          <div class="feature">
            <span class="icon">✍️</span>
            <h3>Podpisy cyfrowe</h3>
            <p>Weryfikacja autentyczności nadawcy (RSA-PSS)</p>
          </div>
          <div class="feature">
            <span class="icon">🔑</span>
            <h3>2FA Authentication</h3>
            <p>Dwuetapowa autoryzacja TOTP</p>
          </div>
          <div class="feature">
            <span class="icon">📎</span>
            <h3>Bezpieczne załączniki</h3>
            <p>Zaszyfrowane pliki integralną częścią wiadomości</p>
          </div>
        </div>

        <div class="actions">
          <button routerLink="/register" class="btn-primary">
            Zarejestruj się
          </button>
          <button routerLink="/login" class="btn-secondary">
            Zaloguj się
          </button>
        </div>
      </div>

      <div class="security-info">
        <h3>🛡️ Twoje bezpieczeństwo to priorytet</h3>
        <ul>
          <li>✅ Klucze prywatne szyfrowane Twoim hasłem (PBKDF2 100k iteracji)</li>
          <li>✅ Hasła hashowane z Argon2id + salt</li>
          <li>✅ Rate limiting na endpointach auth</li>
          <li>✅ Zero dostępu serwera do treści wiadomości</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .landing {
      min-height: 100vh;
      background-color: #f5f5f5;
      padding: 40px 20px;
    }

    .hero {
      max-width: 900px;
      margin: 0 auto;
      text-align: center;
    }

    h1 {
      font-size: 36px;
      margin-bottom: 10px;
      color: #333;
    }

    .tagline {
      font-size: 18px;
      margin-bottom: 50px;
      color: #666;
    }

    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 50px;
    }

    .feature {
      background-color: white;
      padding: 25px;
      border-radius: 4px;
      border: 1px solid #ddd;
    }

    .icon {
      font-size: 32px;
      display: block;
      margin-bottom: 10px;
    }

    .feature h3 {
      margin: 10px 0;
      font-size: 18px;
      color: #333;
    }

    .feature p {
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    }

    .actions {
      display: flex;
      gap: 15px;
      justify-content: center;
      margin-bottom: 60px;
    }

    .btn-primary, .btn-secondary {
      padding: 12px 30px;
      font-size: 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }

    .btn-primary {
      background-color: #007bff;
      color: white;
    }

    .btn-primary:hover {
      background-color: #0056b3;
    }

    .btn-secondary {
      background-color: white;
      color: #007bff;
      border: 1px solid #007bff;
    }

    .btn-secondary:hover {
      background-color: #f8f9fa;
    }

    .security-info {
      max-width: 700px;
      margin: 0 auto;
      background-color: white;
      padding: 30px;
      border-radius: 4px;
      border: 1px solid #ddd;
      text-align: left;
    }

    .security-info h3 {
      text-align: center;
      margin-bottom: 20px;
      font-size: 20px;
      color: #333;
    }

    .security-info ul {
      list-style: none;
      padding: 0;
    }

    .security-info li {
      padding: 8px 0;
      font-size: 15px;
      line-height: 1.6;
      color: #555;
    }

    @media (max-width: 768px) {
      h1 {
        font-size: 28px;
      }

      .tagline {
        font-size: 16px;
      }

      .actions {
        flex-direction: column;
        align-items: center;
      }

      .btn-primary, .btn-secondary {
        width: 100%;
        max-width: 300px;
      }
    }
  `]
})
export class LandingComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  async ngOnInit() {
    // Jeśli użytkownik jest już zalogowany, przekieruj do wiadomości
    await this.authService.checkAuth();
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/messages']);
    }
  }
}
