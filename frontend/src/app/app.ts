import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { HeaderComponent } from './components/header/header.component';
import { NavMenuComponent } from './components/nav-menu/nav-menu.component';
import { SearchModalComponent } from './components/search-modal/search-modal.component';
import { AuthModalComponent } from './components/auth-modal/auth-modal.component';
import { LoginScreenComponent } from './components/login-screen/login-screen.component';
import { FooterComponent } from './components/footer/footer.component';
import { LiveNewsWidgetComponent } from './components/live-news-widget/live-news-widget.component';
import { AuthService } from './services/auth.service';
import { UserProfile } from './models/trade.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    NavMenuComponent,
    SearchModalComponent,
    AuthModalComponent,
    LoginScreenComponent,
    FooterComponent,
    LiveNewsWidgetComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  mobileSidebarOpen = signal(false);
  currentUser: UserProfile | null = null;
  private authSub?: Subscription;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authSub = this.authService.currentUser$.subscribe(u => {
      this.currentUser = u;
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update(v => !v);
  }
}
