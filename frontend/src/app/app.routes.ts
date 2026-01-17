import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { RegisterComponent } from './components/register/register.component';
import { LoginComponent } from './components/login/login.component';
import { MessageListComponent } from './components/message-list/message-list.component';
import { SendMessageComponent } from './components/send-message/send-message.component';
import { ViewMessageComponent } from './components/view-message/view-message.component';
import { TotpSetupComponent } from './components/totp-setup/totp-setup.component';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  { path: '', component: LandingComponent, canActivate: [guestGuard] },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },
  { path: 'messages', component: MessageListComponent, canActivate: [authGuard] },
  { path: 'messages/send', component: SendMessageComponent, canActivate: [authGuard] },
  { path: 'messages/:id', component: ViewMessageComponent, canActivate: [authGuard] },
  { path: 'totp', component: TotpSetupComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '/' }
];
