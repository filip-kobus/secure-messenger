import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MessageService, Message } from '../../services/message.service';

@Component({
  selector: 'app-message-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <div class="header">
        <h1>Wiadomości</h1>
        <div class="actions">
          <button (click)="navigateToSend()">Napisz wiadomość</button>
          <button (click)="navigateToTotp()">Ustawienia 2FA</button>
        </div>
      </div>

      <div class="tabs">
        <button 
          [class.active]="activeTab === 'inbox'"
          (click)="activeTab = 'inbox'; loadMessages()">
          Odebrane ({{ inbox.length }})
        </button>
        <button 
          [class.active]="activeTab === 'sent'"
          (click)="activeTab = 'sent'; loadMessages()">
          Wysłane ({{ sent.length }})
        </button>
      </div>

      <div class="error" *ngIf="error">{{ error }}</div>

      <div class="messages" *ngIf="!loading">
        <div 
          *ngFor="let message of activeTab === 'inbox' ? inbox : sent"
          class="message"
          [class.unread]="!message.is_read && activeTab === 'inbox'"
          (click)="viewMessage(message)">
          <div class="message-header">
            <strong>
              {{ activeTab === 'inbox' ? 'Od: ' + message.sender_username : 'Do: ' + message.recipient_username }}
            </strong>
            <span class="date">{{ formatDate(message.created_at) }}</span>
          </div>
          <div class="message-preview">
            <span *ngIf="activeTab === 'inbox'">
              {{ message.is_read ? '✓' : '✉' }} Zaszyfrowana wiadomość
            </span>
            <span *ngIf="activeTab === 'sent'">
              {{ message.is_read ? '✓ Odczytana' : '✉ Nieodczytana' }}
            </span>
            <span *ngIf="message.attachments && message.attachments.length > 0">
              ({{ message.attachments.length }} załącznik<span *ngIf="message.attachments.length > 1">i/ów</span>)
            </span>
          </div>
        </div>

        <div *ngIf="(activeTab === 'inbox' ? inbox : sent).length === 0" class="empty">
          Brak wiadomości
        </div>
      </div>

      <div *ngIf="loading" class="loading">Ładowanie...</div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 800px;
      margin: 20px auto;
      padding: 20px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .actions {
      display: flex;
      gap: 10px;
    }

    button {
      padding: 10px 15px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    button:hover {
      background-color: #0056b3;
    }

    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 2px solid #ccc;
    }

    .tabs button {
      background-color: transparent;
      color: #333;
      border: none;
      border-bottom: 2px solid transparent;
      padding: 10px 20px;
      cursor: pointer;
    }

    .tabs button.active {
      border-bottom-color: #007bff;
      color: #007bff;
    }

    .messages {
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    .message {
      padding: 15px;
      border-bottom: 1px solid #eee;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .message:last-child {
      border-bottom: none;
    }

    .message:hover {
      background-color: #f5f5f5;
    }

    .message.unread {
      background-color: #e3f2fd;
      font-weight: bold;
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }

    .date {
      color: #666;
      font-size: 14px;
    }

    .message-preview {
      color: #666;
      font-size: 14px;
    }

    .empty {
      padding: 40px;
      text-align: center;
      color: #666;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
    }

    .error {
      color: red;
      padding: 10px;
      margin-bottom: 15px;
      border: 1px solid red;
      border-radius: 4px;
      background-color: #ffe6e6;
    }
  `]
})
export class MessageListComponent implements OnInit {
  inbox: Message[] = [];
  sent: Message[] = [];
  activeTab: 'inbox' | 'sent' = 'inbox';
  loading = false;
  error = '';

  constructor(
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadAllMessages();
  }

  loadAllMessages() {
    this.loading = true;
    this.error = '';

    // Ładuj obie listy równolegle
    this.messageService.getInbox().subscribe({
      next: (messages) => {
        this.inbox = messages;
      },
      error: (err) => {
        this.error = 'Błąd ładowania wiadomości odebranych';
      }
    });

    this.messageService.getSent().subscribe({
      next: (messages) => {
        this.sent = messages;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Błąd ładowania wiadomości wysłanych';
        this.loading = false;
      }
    });
  }

  loadMessages() {
    // Przeładuj wiadomości przy zmianie zakładki aby odświeżyć status is_read
    this.loadAllMessages();
  }

  viewMessage(message: Message) {
    this.router.navigate(['/messages', message.id]);
  }

  navigateToSend() {
    this.router.navigate(['/messages/send']);
  }

  navigateToTotp() {
    this.router.navigate(['/totp']);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('pl-PL');
  }
}
