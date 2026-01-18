import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CryptoService } from '../../services/crypto.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  token: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  loading: boolean = false;
  error: string = '';
  success: boolean = false;

  constructor(
    private authService: AuthService,
    private cryptoService: CryptoService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParams['token'] || '';
    if (!this.token) {
      this.error = 'Brak tokenu resetu hasła';
    }
  }

  onSubmit() {
    if (!this.token) {
      this.error = 'Brak tokenu resetu hasła';
      return;
    }

    if (!this.newPassword || !this.confirmPassword) {
      this.error = 'Wypełnij wszystkie pola';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Hasła nie są identyczne';
      return;
    }

    this.loading = true;
    this.error = '';

    this.resetPasswordWithNewKeys();
  }

  async resetPasswordWithNewKeys() {
    try {
      const { publicKey, privateKey } = await this.cryptoService.generateKeyPair();
      const encryptedPrivateKey = await this.cryptoService.encryptPrivateKey(privateKey, this.newPassword);

      this.authService.resetPassword(this.token, this.newPassword, publicKey, encryptedPrivateKey).subscribe({
        next: () => {
          this.loading = false;
          this.success = true;
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.detail || 'Wystąpił błąd podczas resetowania hasła';
        }
      });
    } catch (err) {
      this.loading = false;
      this.error = 'Błąd generowania kluczy';
    }
  }
}
