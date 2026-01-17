import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule],
  template: `
    <div class="app">
      <header *ngIf="currentUser">
        <div class="header-content">
          <h2>Secure Messenger</h2>
          <div class="user-info">
            <span>{{ currentUser.username }}</span>
            <button (click)="logout()">Wyloguj</button>
          </div>
        </div>
      </header>
      
      <main>
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    header {
      background-color: #007bff;
      color: white;
      padding: 15px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    h2 {
      margin: 0;
      font-size: 24px;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .user-info span {
      font-weight: bold;
    }

    .user-info button {
      padding: 8px 15px;
      background-color: white;
      color: #007bff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }

    .user-info button:hover {
      background-color: #f0f0f0;
    }

    main {
      flex: 1;
      background-color: #f5f5f5;
    }
  `]
})
export class AppComponent implements OnInit {
  currentUser: any = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    // Sprawdź auth przy starcie
    await this.authService.checkAuth();
    this.currentUser = this.authService.getCurrentUser();
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }
}
