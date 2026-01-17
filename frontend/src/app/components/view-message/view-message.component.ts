import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService, Message, Attachment } from '../../services/message.service';

@Component({
  selector: 'app-view-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <div class="header">
        <h1>Wiadomość</h1>
        <button (click)="goBack()">← Powrót</button>
      </div>

      <div *ngIf="loading" class="loading">Ładowanie...</div>
      <div *ngIf="error" class="error">{{ error }}</div>

      <div *ngIf="message && !loading" class="message-details">
        <div class="message-header">
          <div class="info-row">
            <strong>Od:</strong> {{ message.sender_username }}
          </div>
          <div class="info-row">
            <strong>Do:</strong> {{ message.recipient_username }}
          </div>
          <div class="info-row">
            <strong>Data:</strong> {{ formatDate(message.created_at) }}
          </div>
          <div class="info-row">
            <strong>Podpis:</strong> 
            <span [class]="signatureVerified ? 'verified' : 'not-verified'">
              {{ signatureVerified ? '✓ Zweryfikowany' : '✗ Niezweryfikowany' }}
            </span>
          </div>
        </div>

        <div class="message-content">
          <h3>Treść:</h3>
          <div class="content-box" *ngIf="decryptedContent">
            {{ decryptedContent }}
          </div>
          <div class="content-box" *ngIf="!decryptedContent">
            <em>Deszyfrowanie...</em>
          </div>
        </div>

        <div class="attachments" *ngIf="message.attachments && message.attachments.length > 0">
          <h3>Załączniki ({{ message.attachments.length }}):</h3>
          <div class="attachment-list">
            <div *ngFor="let attachment of message.attachments" class="attachment-item">
              <div class="attachment-info">
                <strong>{{ attachment.filename }}</strong>
                <span class="file-size">{{ formatFileSize(attachment.size) }}</span>
              </div>
              <button (click)="downloadAttachment(attachment)">
                Pobierz
              </button>
            </div>
          </div>
        </div>

        <div class="actions">
          <button 
            *ngIf="isInbox && !message.is_read" 
            (click)="markAsRead()"
            [disabled]="markingAsRead">
            {{ markingAsRead ? 'Oznaczanie...' : 'Oznacz jako przeczytane' }}
          </button>
          <button 
            (click)="deleteMessage()"
            [disabled]="deleting"
            class="delete-btn">
            {{ deleting ? 'Usuwanie...' : 'Usuń wiadomość' }}
          </button>
        </div>
      </div>
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

    button {
      padding: 10px 15px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    button:hover:not(:disabled) {
      background-color: #0056b3;
    }

    button:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }

    .delete-btn {
      background-color: #dc3545;
    }

    .delete-btn:hover:not(:disabled) {
      background-color: #c82333;
    }

    .loading, .error {
      padding: 20px;
      text-align: center;
    }

    .error {
      color: red;
      border: 1px solid red;
      border-radius: 4px;
      background-color: #ffe6e6;
    }

    .message-details {
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 20px;
    }

    .message-header {
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #eee;
    }

    .info-row {
      margin-bottom: 10px;
    }

    .verified {
      color: green;
    }

    .not-verified {
      color: red;
    }

    .message-content {
      margin-bottom: 20px;
    }

    .content-box {
      padding: 15px;
      background-color: #f5f5f5;
      border-radius: 4px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .attachments {
      margin-bottom: 20px;
    }

    .attachment-list {
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    .attachment-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      border-bottom: 1px solid #eee;
    }

    .attachment-item:last-child {
      border-bottom: none;
    }

    .attachment-info {
      display: flex;
      flex-direction: column;
    }

    .file-size {
      font-size: 12px;
      color: #666;
    }

    .actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }

    .actions button {
      flex: 1;
    }
  `]
})
export class ViewMessageComponent implements OnInit {
  message: Message | null = null;
  decryptedContent = '';
  signatureVerified = false;
  loading = false;
  error = '';
  markingAsRead = false;
  deleting = false;
  isInbox = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    const messageId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadMessage(messageId);
  }

  async loadMessage(id: number) {
    this.loading = true;
    
    try {
      // Spróbuj załadować z inbox
      const inboxMessages = await this.messageService.getInbox().toPromise();
      let message = inboxMessages?.find(m => m.id === id);
      
      if (message) {
        this.isInbox = true;
        await this.processMessage(message);
        return;
      }
      
      // Jeśli nie ma w inbox, spróbuj sent
      const sentMessages = await this.messageService.getSent().toPromise();
      message = sentMessages?.find(m => m.id === id);
      
      if (message) {
        this.isInbox = false;
        await this.processMessage(message);
        return;
      }
      
      this.error = 'Wiadomość nie znaleziona';
      this.loading = false;
    } catch (err) {
      this.error = 'Błąd ładowania wiadomości';
      this.loading = false;
    }
  }

  async processMessage(message: Message) {
    this.message = message;
    
    try {
      // Odszyfruj wiadomość (decryptMessage automatycznie wybierze odpowiedni klucz)
      this.decryptedContent = await this.messageService.decryptMessage(message);
      
      // Zweryfikuj podpis
      this.signatureVerified = await this.messageService.verifyMessageSignature(
        message,
        this.decryptedContent
      );
      
      this.loading = false;
    } catch (err) {
      this.error = 'Błąd deszyfrowania wiadomości';
      this.loading = false;
    }
  }

  async downloadAttachment(attachment: Attachment) {
    if (!this.message) return;

    try {
      const blob = await this.messageService.decryptAttachment(attachment, this.message);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      this.error = 'Błąd pobierania załącznika';
    }
  }

  markAsRead() {
    if (!this.message) return;

    this.markingAsRead = true;
    this.messageService.markAsRead(this.message.id).subscribe({
      next: () => {
        if (this.message) {
          this.message.is_read = true;
        }
        this.markingAsRead = false;
      },
      error: () => {
        this.error = 'Błąd oznaczania jako przeczytane';
        this.markingAsRead = false;
      }
    });
  }

  deleteMessage() {
    if (!this.message || !confirm('Czy na pewno chcesz usunąć tę wiadomość?')) {
      return;
    }

    this.deleting = true;
    this.messageService.deleteMessage(this.message.id).subscribe({
      next: () => {
        this.router.navigate(['/messages']);
      },
      error: () => {
        this.error = 'Błąd usuwania wiadomości';
        this.deleting = false;
      }
    });
  }

  goBack() {
    this.router.navigate(['/messages']);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('pl-PL');
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
