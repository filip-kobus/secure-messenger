import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MessageService, Message, Attachment } from '../../services/message.service';

@Component({
  selector: 'app-view-message',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './view-message.component.html',
  styleUrls: ['./view-message.component.css']
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
  downloadingAttachmentId: number | null = null;

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
      const inboxMessages = await firstValueFrom(this.messageService.getInbox());
      let message = inboxMessages?.find(m => m.id === id);
      
      if (message) {
        this.isInbox = true;
        await this.processMessage(message);
        return;
      }
      
      // Jeśli nie ma w inbox, spróbuj sent
      const sentMessages = await firstValueFrom(this.messageService.getSent());
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
      this.decryptedContent = await this.messageService.decryptMessage(message);
      
      this.signatureVerified = await this.messageService.verifyMessageSignature(
        message,
        this.decryptedContent
      );
      
      this.loading = false;
    } catch (err: any) {
      if (err.cancelled) {
        this.router.navigate(['/messages']);
        return;
      }
      if (err.invalidPassword) {
        this.router.navigate(['/messages'], { queryParams: { error: 'invalid_password' } });
        return;
      }
      this.error = 'Błąd deszyfrowania wiadomości';
      this.loading = false;
    }
  }

  async downloadAttachment(attachment: Attachment) {
    if (!this.message) return;

    this.downloadingAttachmentId = attachment.id;
    this.error = '';

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
    } catch (err: any) {
      if (err.cancelled) {
        this.router.navigate(['/messages']);
        return;
      }
      if (err.invalidPassword) {
        this.router.navigate(['/messages'], { queryParams: { error: 'invalid_password' } });
        return;
      }
      this.error = err.message || 'Błąd pobierania załącznika';
      console.error('Download error:', err);
    } finally {
      this.downloadingAttachmentId = null;
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
