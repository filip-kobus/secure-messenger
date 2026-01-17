import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Pobierz token z sessionStorage
  const token = sessionStorage.getItem('access_token');
  
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

  return next(clonedRequest);
};
