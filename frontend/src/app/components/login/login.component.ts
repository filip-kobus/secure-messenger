import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
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

  async ngOnInit() {
    const isAuthenticated = await this.authService.checkAuth();
    if (isAuthenticated) {
      this.router.navigate(['/messages']);
    }
  }

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
