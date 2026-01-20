import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TotpService } from '../../services/totp.service';

@Component({
  selector: 'app-totp-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './totp-setup.component.html',
  styleUrls: ['./totp-setup.component.css']
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
        console.log('TOTP status:', response);
        if (this.initialized && !this.enabled) {
          console.log('Initializing TOTP setup as it is not enabled yet.');
          this.initializeTOTP();
        }
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
