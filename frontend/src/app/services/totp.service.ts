import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

interface TOTPInitResponse {
  secret: string;
  qr_code: string;
}

interface TOTPStatusResponse {
  is_2fa_enabled: boolean;
  has_secret: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TotpService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  initializeTOTP(): Observable<TOTPInitResponse> {
    return this.http.post<TOTPInitResponse>(`${this.apiUrl}/totp/initialize`, {});
  }

  getTOTPStatus(): Observable<TOTPStatusResponse> {
    return this.http.get<TOTPStatusResponse>(`${this.apiUrl}/totp/status`);
  }

  enableTOTP(totpCode: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/totp/enable`, { totp_code: totpCode });
  }

  disableTOTP(totpCode: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/totp/disable`, { totp_code: totpCode });
  }
}
