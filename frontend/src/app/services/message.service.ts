import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { CryptoService } from './crypto.service';
import { AuthService } from './auth.service';

export interface Message {
  id: number;
  sender_id: number;
  sender_username: string;
  recipient_id?: number;
  recipient_username?: string;
  encrypted_content: string;
  encrypted_symmetric_key: string;
  encrypted_symmetric_key_sender?: string;
  signature: string;
  is_read: boolean;
  created_at: string;
  is_decryptable_receiver: boolean;
  is_decryptable_sender: boolean;
  attachments?: Attachment[];
}

export interface Attachment {
  id: number;
  filename: string;
  encrypted_data?: string;
  mime_type: string;
  size: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  public_key: string;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private apiUrl = 'http://localhost:8000';

  constructor(
    private http: HttpClient,
    private cryptoService: CryptoService,
    private authService: AuthService
  ) {}

  async sendMessage(
    recipientUsername: string,
    content: string,
    files: File[] = []
  ): Promise<any> {
    // Pobierz klucz publiczny odbiorcy
    const recipient = await firstValueFrom(this.http.get<User>(
      `${this.apiUrl}/users/by-username/${recipientUsername}`
    ));

    if (!recipient) {
      throw new Error('Recipient not found');
    }

    // Generuj klucz symetryczny
    const symmetricKey = await this.cryptoService.generateSymmetricKey();

    // Zaszyfruj wiadomość
    const { encrypted: encryptedContent } = await this.cryptoService.encryptMessage(
      content,
      symmetricKey
    );

    // Zaszyfruj klucz symetryczny kluczem publicznym odbiorcy
    const encryptedSymmetricKey = await this.cryptoService.encryptSymmetricKey(
      symmetricKey,
      recipient.public_key
    );

    // Zaszyfruj klucz symetryczny SWOIM kluczem publicznym (dla nadawcy)
    const senderPublicKey = await this.authService.getCurrentUserPublicKey();
    let encryptedSymmetricKeySender = undefined;
    if (senderPublicKey) {
      encryptedSymmetricKeySender = await this.cryptoService.encryptSymmetricKey(
        symmetricKey,
        senderPublicKey
      );
    }

    // Sprawdź czy jest klucz prywatny
    let privateKey = await this.authService.getPrivateKey();
    
    // Jeśli brak klucza prywatnego, poproś o hasło
    if (!privateKey) {
      const password = await this.authService.promptForPassword();
      if (!password) {
        const error: any = new Error('User cancelled');
        error.cancelled = true;
        throw error;
      }
      
      const success = await this.authService.unlockPrivateKey(password);
      if (!success) {
        const error: any = new Error('Nieprawidłowe hasło');
        error.invalidPassword = true;
        throw error;
      }
      
      privateKey = await this.authService.getPrivateKey();
    }
    
    if (!privateKey) {
      throw new Error('Klucz prywatny niedostępny');
    }
    
    const signature = await this.cryptoService.signMessage(content, privateKey);

    // Zaszyfruj załączniki
    const attachments = [];
    for (const file of files) {
      const { encrypted } = await this.cryptoService.encryptAttachment(
        file,
        symmetricKey
      );
      attachments.push({
        filename: file.name,
        encrypted_data: encrypted,
        mime_type: file.type,
        size: file.size
      });
    }

    // Wyślij na serwer
    return firstValueFrom(this.http.post(`${this.apiUrl}/messages/send`, {
      receiver_id: recipient.id,
      encrypted_content: encryptedContent,
      encrypted_symmetric_key: encryptedSymmetricKey,
      encrypted_symmetric_key_sender: encryptedSymmetricKeySender,
      signature: signature,
      attachments: attachments
    }));
  }

  getInbox(): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.apiUrl}/messages/inbox`);
  }

  getSent(): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.apiUrl}/messages/sent`);
  }

  async decryptMessage(message: Message): Promise<string> {
    // Sprawdź czy jest klucz prywatny
    let privateKey = await this.authService.getPrivateKey();
    
    // Jeśli brak klucza prywatnego, poproś o hasło
    if (!privateKey) {
      const password = await this.authService.promptForPassword();
      if (!password) {
        const error: any = new Error('User cancelled');
        error.cancelled = true;
        throw error;
      }
      
      const success = await this.authService.unlockPrivateKey(password);
      if (!success) {
        const error: any = new Error('Invalid password');
        error.invalidPassword = true;
        throw error;
      }
      
      privateKey = await this.authService.getPrivateKey();
    }
    
    if (!privateKey) {
      throw new Error('Private key not available');
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Current user not available');
    }

    // Określ, który klucz symetryczny użyć
    let encryptedKey: string;
    if (message.sender_id === currentUser.id) {
      // Jesteś nadawcą - użyj encrypted_symmetric_key_sender
      if (!message.encrypted_symmetric_key_sender) {
        throw new Error('Sender key not available');
      }
      encryptedKey = message.encrypted_symmetric_key_sender;
    } else {
      // Jesteś odbiorcą - użyj encrypted_symmetric_key
      encryptedKey = message.encrypted_symmetric_key;
    }

    // Odszyfruj klucz symetryczny
    const symmetricKey = await this.cryptoService.decryptSymmetricKey(
      encryptedKey,
      privateKey
    );

    // Odszyfruj wiadomość (iv jest wbudowane w encrypted_content)
    return await this.cryptoService.decryptMessage(
      message.encrypted_content,
      symmetricKey
    );
  }

  async verifyMessageSignature(message: Message, decryptedContent: string): Promise<boolean> {
    // Pobierz klucz publiczny nadawcy
    const sender = await firstValueFrom(this.http.get<User>(
      `${this.apiUrl}/users/${message.sender_id}`
    ));

    if (!sender) {
      return false;
    }

    return await this.cryptoService.verifySignature(
      decryptedContent,
      message.signature,
      sender.public_key
    );
  }

  async decryptAttachment(attachment: Attachment, message: Message): Promise<Blob> {
    // Pobierz zaszyfrowane dane z backendu jeśli nie są dostępne
    if (!attachment.encrypted_data) {
      const fullAttachment = await firstValueFrom(
        this.http.get<Attachment>(`${this.apiUrl}/messages/attachments/${attachment.id}`)
      );
      attachment.encrypted_data = fullAttachment.encrypted_data;
    }

    // Sprawdź czy jest klucz prywatny
    let privateKey = await this.authService.getPrivateKey();
    
    // Jeśli brak klucza prywatnego, poproś o hasło
    if (!privateKey) {
      const password = await this.authService.promptForPassword();
      if (!password) {
        const error: any = new Error('User cancelled');
        error.cancelled = true;
        throw error;
      }
      
      const success = await this.authService.unlockPrivateKey(password);
      if (!success) {
        const error: any = new Error('Invalid password');
        error.invalidPassword = true;
        throw error;
      }
      
      privateKey = await this.authService.getPrivateKey();
    }
    
    if (!privateKey) {
      throw new Error('Private key not available');
    }

    if (!attachment.encrypted_data) {
      throw new Error('Attachment data not available');
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Current user not available');
    }

    // Określ, który klucz symetryczny użyć
    let encryptedKey: string;
    if (message.sender_id === currentUser.id) {
      // Jesteś nadawcą - użyj encrypted_symmetric_key_sender
      if (!message.encrypted_symmetric_key_sender) {
        throw new Error('Sender key not available');
      }
      encryptedKey = message.encrypted_symmetric_key_sender;
    } else {
      // Jesteś odbiorcą - użyj encrypted_symmetric_key
      encryptedKey = message.encrypted_symmetric_key;
    }

    // Odszyfruj klucz symetryczny
    const symmetricKey = await this.cryptoService.decryptSymmetricKey(
      encryptedKey,
      privateKey
    );

    // Odszyfruj załącznik (iv jest wbudowane w encrypted_data)
    const decryptedData = await this.cryptoService.decryptAttachment(
      attachment.encrypted_data,
      symmetricKey
    );

    return new Blob([decryptedData], { type: attachment.mime_type });
  }

  markAsRead(messageId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/messages/${messageId}/read`, {});
  }

  deleteMessage(messageId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/messages/${messageId}`);
  }

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`);
  }
}
