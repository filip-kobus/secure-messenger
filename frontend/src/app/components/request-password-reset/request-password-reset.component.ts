import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-request-password-reset',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './request-password-reset.component.html',
  styleUrl: './request-password-reset.component.css'
})
export class RequestPasswordResetComponent {
  email: string = '';
  message: string = '';
  loading: boolean = false;
  error: string = '';

  constructor(private authService: AuthService) {}

  onSubmit() {
    if (!this.email) {
      this.error = 'Podaj adres email';
      return;
    }

    this.loading = true;
    this.error = '';
    this.message = '';

    this.authService.requestPasswordReset(this.email).subscribe({
      next: (response) => {
        this.loading = false;
        this.message = response.message;
        console.log(this.message);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.detail || 'Wystąpił błąd podczas żądania resetu hasła';
      }
    });
  }

}
