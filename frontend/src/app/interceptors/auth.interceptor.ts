import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap } from 'rxjs/operators';
import { throwError, from } from 'rxjs';
import { AuthService } from '../services/auth.service';

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  
  // Pobierz CSRF token z cookie
  const csrfToken = getCookie('XSRF-TOKEN');
  
  const clonedRequest = req.clone({
    withCredentials: true,
    setHeaders: csrfToken ? {
      'X-XSRF-TOKEN': csrfToken
    } : {}
  });

  return next(clonedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh-token') && !req.url.includes('/auth/login')) {
        return from(authService.refreshToken()).pipe(
          switchMap(success => {
            if (success) {
              const newCsrfToken = getCookie('XSRF-TOKEN');
              const retryRequest = req.clone({
                withCredentials: true,
                setHeaders: newCsrfToken ? {
                  'X-XSRF-TOKEN': newCsrfToken
                } : {}
              });
              return next(retryRequest);
            } else {
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
