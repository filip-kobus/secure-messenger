import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService, User } from '../../services/message.service';

@Component({
  selector: 'app-send-message',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <h1>Wyślij wiadomość</h1>

      <form (ngSubmit)="onSubmit()" #sendForm="ngForm">
        <div class="form-group">
          <label for="recipient">Odbiorca:</label>
          <select 
            id="recipient" 
            name="recipient"
            [(ngModel)]="recipientUsername" 
            required>
            <option value="">Wybierz użytkownika</option>
            <option *ngFor="let user of users" [value]="user.username">
              {{ user.username }} ({{ user.email }})
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="content">Treść wiadomości:</label>
          <textarea 
            id="content" 
            name="content"
            [(ngModel)]="content" 
            required
            rows="8"
            placeholder="Wpisz treść wiadomości..."></textarea>
        </div>

        <div class="form-group">
          <label for="files">Załączniki (max 10 plików, max 10MB każdy):</label>
          <input 
            type="file" 
            id="files"
            (change)="onFileChange($event)"
            multiple
            accept="*/*">
          <div class="file-list" *ngIf="selectedFiles.length > 0">
            <div *ngFor="let file of selectedFiles; let i = index" class="file-item">
              {{ file.name }} ({{ formatFileSize(file.size) }})
              <button type="button" (click)="removeFile(i)">✕</button>
            </div>
          </div>
        </div>

        <div class="error" *ngIf="error">{{ error }}</div>
        <div class="success" *ngIf="success">{{ success }}</div>

        <div class="button-group">
          <button 
            type="submit" 
            [disabled]="!sendForm.valid || loading">
            {{ loading ? 'Wysyłanie...' : 'Wyślij' }}
          </button>
          <button 
            type="button" 
            (click)="cancel()"
            [disabled]="loading">
            Anuluj
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .container {
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
    }

    .form-group {
      margin-bottom: 15px;
    }

    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }

    select, textarea {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-sizing: border-box;
    }

    textarea {
      resize: vertical;
      font-family: inherit;
    }

    input[type="file"] {
      width: 100%;
    }

    .file-list {
      margin-top: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 10px;
    }

    .file-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px;
      margin-bottom: 5px;
      background-color: #f5f5f5;
      border-radius: 3px;
    }

    .file-item button {
      background-color: #dc3545;
      color: white;
      border: none;
      border-radius: 3px;
      padding: 2px 8px;
      cursor: pointer;
      font-size: 14px;
    }

    .button-group {
      display: flex;
      gap: 10px;
    }

    button {
      padding: 10px 20px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      flex: 1;
    }

    button[type="button"] {
      background-color: #6c757d;
    }

    button:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }

    button:hover:not(:disabled) {
      opacity: 0.9;
    }

    .error {
      color: red;
      margin-bottom: 15px;
      padding: 10px;
      border: 1px solid red;
      border-radius: 4px;
      background-color: #ffe6e6;
    }

    .success {
      color: green;
      margin-bottom: 15px;
      padding: 10px;
      border: 1px solid green;
      border-radius: 4px;
      background-color: #e6ffe6;
    }
  `]
})
export class SendMessageComponent implements OnInit {
  users: User[] = [];
  recipientUsername = '';
  content = '';
  selectedFiles: File[] = [];
  error = '';
  success = '';
  loading = false;

  constructor(
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.messageService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
      },
      error: (err) => {
        this.error = 'Błąd ładowania listy użytkowników';
      }
    });
  }

  onFileChange(event: any) {
    const files: File[] = Array.from(event.target.files || []);
    
    // Walidacja
    if (files.length + this.selectedFiles.length > 10) {
      this.error = 'Maksymalnie 10 załączników';
      return;
    }

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        this.error = `Plik ${file.name} przekracza 10MB`;
        return;
      }
    }

    const totalSize = [...this.selectedFiles, ...files].reduce((sum, f) => sum + f.size, 0);
    if (totalSize > 25 * 1024 * 1024) {
      this.error = 'Łączny rozmiar załączników przekracza 25MB';
      return;
    }

    this.selectedFiles = [...this.selectedFiles, ...files];
    this.error = '';
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  async onSubmit() {
    this.error = '';
    this.success = '';
    this.loading = true;

    try {
      await this.messageService.sendMessage(
        this.recipientUsername,
        this.content,
        this.selectedFiles
      );
      this.success = 'Wiadomość wysłana pomyślnie!';
      setTimeout(() => {
        this.router.navigate(['/messages']);
      }, 1500);
    } catch (err: any) {
      this.error = err.error?.detail || 'Błąd wysyłania wiadomości';
      this.loading = false;
    }
  }

  cancel() {
    this.router.navigate(['/messages']);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
