import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap } from 'rxjs/operators';
import { throwError, from } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  
  const clonedRequest = req.clone({
    withCredentials: true
  });

  return next(clonedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh-token') && !req.url.includes('/auth/login')) {
        return from(authService.refreshToken()).pipe(
          switchMap(success => {
            if (success) {
              const retryRequest = req.clone({
                withCredentials: true
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
