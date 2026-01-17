import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap } from 'rxjs/operators';
import { throwError, from } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  
  // Pobierz token z sessionStorage
  const token = sessionStorage.getItem('secure_messenger_access_token');
  
  // Klonuj request i dodaj nagłówki
  let clonedRequest = req.clone({
    withCredentials: true
  });

  // Jeśli token istnieje, dodaj nagłówek Authorization
  if (token) {
    clonedRequest = clonedRequest.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(clonedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      // Jeśli otrzymamy 401 i to nie jest request do /auth/refresh-token
      if (error.status === 401 && !req.url.includes('/auth/refresh-token') && !req.url.includes('/auth/login')) {
        // Spróbuj odświeżyć token
        return from(authService.refreshToken()).pipe(
          switchMap(success => {
            if (success) {
              // Token odświeżony - ponów request z nowym tokenem
              const newToken = sessionStorage.getItem('secure_messenger_access_token');
              const retryRequest = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${newToken}`
                }
              });
              return next(retryRequest);
            } else {
              // Nie udało się odświeżyć - zwróć błąd
              return throwError(() => error);
            }
          }),
          catchError(() => throwError(() => error))
        );
      }
      
      return throwError(() => error);
    })
  );
};
