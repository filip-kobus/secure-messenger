import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TotpService } from '../../services/totp.service';

@Component({
  selector: 'app-totp-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <h1>Ustawienia 2FA (TOTP)</h1>

      <div *ngIf="!initialized && !loading">
        <p>Włącz dwuetapową weryfikację dla zwiększenia bezpieczeństwa konta.</p>
        <button (click)="initializeTOTP()">Włącz 2FA</button>
      </div>

      <div *ngIf="initialized && !enabled">
        <h2>Skanuj kod QR w aplikacji authenticator:</h2>
        
        <div class="qr-code">
          <img [src]="qrCode" alt="QR Code" style="max-width: 300px;">
        </div>
        
        <p>Lub wprowadź ręcznie kod: <strong>{{ secret }}</strong></p>

        <form (ngSubmit)="enableTOTP()">
          <div class="form-group">
            <label for="totpCode">Wprowadź 6-cyfrowy kod z aplikacji:</label>
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

          <button type="submit" [disabled]="loading || totpCode.length !== 6">
            {{ loading ? 'Weryfikacja...' : 'Potwierdź i włącz 2FA' }}
          </button>
        </form>
      </div>

      <div *ngIf="enabled">
        <div class="success">
          <p>✓ Dwuetapowa weryfikacja jest włączona</p>
        </div>

        <form (ngSubmit)="disableTOTP()">
          <div class="form-group">
            <label for="disableCode">Aby wyłączyć, wprowadź kod:</label>
            <input 
              type="text" 
              id="disableCode" 
              name="disableCode"
              [(ngModel)]="disableCode" 
              required
              maxlength="6"
              placeholder="123456">
          </div>

          <div class="error" *ngIf="error">{{ error }}</div>

          <button type="submit" [disabled]="loading || disableCode.length !== 6" class="danger">
            {{ loading ? 'Wyłączanie...' : 'Wyłącz 2FA' }}
          </button>
        </form>
      </div>

      <div *ngIf="loading && !initialized" class="loading">
        Ładowanie...
      </div>

      <button (click)="goBack()" class="back-btn">Powrót do wiadomości</button>
    </div>
  `,
  styles: [`
    .container {
      max-width: 500px;
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
      text-align: center;
      font-size: 18px;
      letter-spacing: 5px;
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
      margin-bottom: 10px;
    }

    button:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }

    button:hover:not(:disabled) {
      background-color: #0056b3;
    }

    button.danger {
      background-color: #dc3545;
    }

    button.danger:hover:not(:disabled) {
      background-color: #c82333;
    }

    .back-btn {
      background-color: #6c757d;
    }

    .back-btn:hover {
      background-color: #5a6268;
    }

    .qr-code {
      display: flex;
      justify-content: center;
      margin: 20px 0;
      padding: 20px;
      background-color: white;
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    .error {
      color: red;
      margin-bottom: 15px;
      padding: 10px;
      border: 1px solid red;
      border-radius: 4px;
      background-color: #ffe6e6;
    }

    .success {
      color: green;
      margin-bottom: 15px;
      padding: 10px;
      border: 1px solid green;
      border-radius: 4px;
      background-color: #e6ffe6;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
    }
  `]
})
export class TotpSetupComponent implements OnInit {
  initialized = false;
  enabled = false;
  secret = '';
  qrCode: string = '';
  totpCode = '';
  disableCode = '';
  error = '';
  loading = false;

  constructor(
    private totpService: TotpService,
    private router: Router
  ) {}

  ngOnInit() {
    this.checkTOTPStatus();
  }

  checkTOTPStatus() {
    this.loading = true;
    this.totpService.getTOTPStatus().subscribe({
      next: (response) => {
        this.enabled = response.is_2fa_enabled;
        this.initialized = response.has_secret;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error checking TOTP status:', err);
        this.loading = false;
      }
    });
  }

  initializeTOTP() {
    this.loading = true;
    this.error = '';

    this.totpService.initializeTOTP().subscribe({
      next: (response) => {
        this.secret = response.secret;
        this.qrCode = response.qr_code;
        this.initialized = true;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.detail || 'Błąd inicjalizacji 2FA';
        this.loading = false;
      }
    });
  }

  enableTOTP() {
    this.loading = true;
    this.error = '';

    this.totpService.enableTOTP(this.totpCode).subscribe({
      next: () => {
        this.enabled = true;
        this.loading = false;
        this.totpCode = '';
      },
      error: (err) => {
        this.error = err.error?.detail || 'Błąd weryfikacji kodu';
        this.loading = false;
      }
    });
  }

  disableTOTP() {
    this.loading = true;
    this.error = '';

    this.totpService.disableTOTP(this.disableCode).subscribe({
      next: () => {
        this.enabled = false;
        this.initialized = false;
        this.secret = '';
        this.qrCode = '';
        this.disableCode = '';
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.detail || 'Błąd wyłączania 2FA';
        this.loading = false;
      }
    });
  }

  goBack() {
    this.router.navigate(['/messages']);
  }
}
