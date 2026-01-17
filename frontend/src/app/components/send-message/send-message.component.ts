import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService, User } from '../../services/message.service';

@Component({
  selector: 'app-send-message',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './send-message.component.html',
  styleUrls: ['./send-message.component.css']
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
