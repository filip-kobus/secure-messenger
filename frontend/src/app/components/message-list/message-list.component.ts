import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
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
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.loadAllMessages();
  }

  loadAllMessages() {
    this.loading = true;
    this.error = '';

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
    this.loadAllMessages();
  }

  viewMessage(message: Message) {
    // Sprawdź czy wiadomość jest odszyfrywalna
    if (this.activeTab === 'inbox' && !message.is_decryptable_receiver) {
      return; // Nie pozwalaj na otwarcie nieodszyfrowanej wiadomości w inbox
    }
    if (this.activeTab === 'sent' && !message.is_decryptable_sender) {
      return; // Nie pozwalaj na otwarcie nieodszyfrowanej wiadomości w sent
    }
    
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
