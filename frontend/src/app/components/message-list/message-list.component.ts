import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MessageService, Message } from '../../services/message.service';

@Component({
  selector: 'app-message-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './message-list.component.html',
  styleUrls: ['./message-list.component.css']
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
