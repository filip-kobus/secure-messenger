import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="app">
      <header *ngIf="(authService.currentUser$ | async) as user">
        <div class="header-content">
          <h2>Secure Messenger</h2>
          <div class="user-info">
            <span>{{ user.username }}</span>
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
export class AppComponent {
  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

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
