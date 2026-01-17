import { Routes } from '@angular/router';
import { RegisterComponent } from './components/register/register.component';
import { LoginComponent } from './components/login/login.component';
import { MessageListComponent } from './components/message-list/message-list.component';
import { SendMessageComponent } from './components/send-message/send-message.component';
import { ViewMessageComponent } from './components/view-message/view-message.component';
import { TotpSetupComponent } from './components/totp-setup/totp-setup.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'messages', component: MessageListComponent },
  { path: 'messages/send', component: SendMessageComponent },
  { path: 'messages/:id', component: ViewMessageComponent },
  { path: 'totp', component: TotpSetupComponent },
  { path: '**', redirectTo: '/login' }
];
