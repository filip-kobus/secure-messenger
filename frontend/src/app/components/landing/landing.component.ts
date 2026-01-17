import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
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
