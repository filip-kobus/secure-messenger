import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Sprawdź czy użytkownik jest zalogowany
  const isAuthenticated = await authService.checkAuth();
  
  if (isAuthenticated) {
    return true;
  }
  
  // Nie zalogowany - przekieruj na landing
  router.navigate(['/']);
  return false;
};
