import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
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
