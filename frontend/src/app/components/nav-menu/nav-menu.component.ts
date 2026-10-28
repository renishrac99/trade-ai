import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserProfile } from '../../models/trade.models';

@Component({
  selector: 'app-nav-menu',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <!-- Desktop Sidebar -->
    <aside class="desktop-sidebar glass-panel">
      <!-- Admin RBAC Section (Visible only to Admin users) -->
      <div class="sidebar-section admin-section-box" *ngIf="user && user.role === 'admin'">
        <span class="section-title admin-title">ADMINISTRATION</span>
        <nav class="nav-links">
          <a routerLink="/admin" routerLinkActive="active" class="nav-link admin-link">
            <div class="crown-icon">👑</div>
            <span>Admin Command Center</span>
            <span class="badge-mini-admin">RBAC</span>
          </a>
        </nav>
      </div>

      <div class="sidebar-section">
        <span class="section-title">CORE PLATFORM</span>
        <nav class="nav-links">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>Dashboard</span>
          </a>

          <a routerLink="/stock/TATASIL" routerLinkActive="active" class="nav-link spotlight-link">
            <div class="spark-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <span>Deep Dive Analytics</span>
            <span class="badge-mini-hot">AI</span>
          </a>

          <a routerLink="/watchlist" routerLinkActive="active" class="nav-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
            </svg>
            <span>Watchlist</span>
          </a>

          <a routerLink="/portfolio" routerLinkActive="active" class="nav-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="20" height="14" x="2" y="5" rx="2"/>
              <line x1="2" x2="22" y1="10" y2="10"/>
            </svg>
            <span>Paper Trading</span>
          </a>
        </nav>
      </div>

      <div class="sidebar-section">
        <span class="section-title">AI INTELLIGENCE</span>
        <nav class="nav-links">
          <a routerLink="/pine-script" routerLinkActive="active" class="nav-link pine-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            <span>Pine Script Studio</span>
            <span class="badge-mini-pine">v5</span>
          </a>

          <a routerLink="/" fragment="morning-signals" class="nav-link ai-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>9:00 AM Signals</span>
            <span class="live-dot"></span>
          </a>

          <a routerLink="/profile" routerLinkActive="active" class="nav-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Profile & Settings</span>
          </a>
        </nav>
      </div>

      <!-- Quick AI Status Banner -->
      <div class="ai-status-card">
        <div class="ai-status-header">
          <div class="ai-chip">TimesFM 3.0</div>
          <span class="mono status-val">99.4% Uptime</span>
        </div>
        <p class="ai-status-desc">Daily morning pre-market inference completes at 08:45 AM before opening bell.</p>
      </div>
    </aside>

    <!-- Mobile Bottom Navigation Bar -->
    <nav class="mobile-bottom-nav glass-panel">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="mobile-nav-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        </svg>
        <span>Home</span>
      </a>

      <a routerLink="/stock/TATASIL" routerLinkActive="active" class="mobile-nav-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
        <span>Tata Silver ETF</span>
      </a>

      <a routerLink="/pine-script" routerLinkActive="active" class="mobile-nav-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/>
        </svg>
        <span>Pine</span>
      </a>

      <a *ngIf="user && user.role === 'admin'" routerLink="/admin" routerLinkActive="active" class="mobile-nav-item admin-mob">
        <span>👑</span>
        <span>Admin</span>
      </a>

      <a routerLink="/watchlist" routerLinkActive="active" class="mobile-nav-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
        </svg>
        <span>Watchlist</span>
      </a>

      <a routerLink="/portfolio" routerLinkActive="active" class="mobile-nav-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect width="20" height="14" x="2" y="5" rx="2"/>
          <line x1="2" x2="22" y1="10" y2="10"/>
        </svg>
        <span>Portfolio</span>
      </a>

      <a routerLink="/profile" routerLinkActive="active" class="mobile-nav-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <span>Profile</span>
      </a>
    </nav>
  `,
  styles: [`
    :host {
      display: block;
    }

    .desktop-sidebar {
      width: 240px;
      height: calc(100vh - 96px);
      position: sticky;
      top: 96px;
      padding: 20px 12px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      border-right: 1px solid var(--border-subtle);
    }

    .sidebar-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .admin-section-box {
      background: rgba(245, 158, 11, 0.06);
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: 12px;
      padding: 10px;
    }
    .admin-title {
      color: #fbbf24 !important;
    }
    .admin-link {
      color: #fbbf24 !important;
    }
    .admin-link:hover, .admin-link.active {
      background: rgba(245, 158, 11, 0.2) !important;
      color: #fff !important;
    }
    .crown-icon {
      font-size: 1rem;
    }
    .badge-mini-admin {
      background: #f59e0b;
      color: #000;
      font-size: 0.6rem;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 4px;
      margin-left: auto;
    }

    .section-title {
      font-size: 0.6875rem;
      font-weight: 800;
      color: var(--text-muted);
      letter-spacing: 0.8px;
      padding-left: 12px;
      margin-bottom: 4px;
    }

    .nav-links {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 0.875rem;
      text-decoration: none;
      transition: all 0.2s ease;
      position: relative;
    }

    .nav-link:hover {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-primary);
    }

    .nav-link.active {
      background: rgba(0, 242, 254, 0.1);
      color: #00f2fe;
      border-left: 3px solid #00f2fe;
      padding-left: 9px;
    }

    .nav-link svg {
      color: currentColor;
    }

    .spotlight-link {
      color: #00f2fe;
    }

    .spark-icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .badge-mini-hot {
      background: linear-gradient(135deg, #f43f5e, #fb7185);
      color: #fff;
      font-size: 0.625rem;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 4px;
      margin-left: auto;
      letter-spacing: 0.5px;
    }

    .ai-link {
      color: #38bdf8;
    }

    .badge-mini-pine {
      font-size: 0.625rem;
      font-weight: 800;
      color: #030b1e;
      background: linear-gradient(135deg, #00f2fe, #4facfe);
      padding: 1px 6px;
      border-radius: 4px;
      margin-left: auto;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .live-dot {
      width: 6px;
      height: 6px;
      background: #00f2fe;
      border-radius: 50%;
      margin-left: auto;
      box-shadow: 0 0 6px #00f2fe;
      animation: pulseGlow 1.5s infinite;
    }

    .ai-status-card {
      margin-top: auto;
      background: rgba(0, 242, 254, 0.04);
      border: 1px solid rgba(0, 242, 254, 0.2);
      border-radius: var(--radius-md);
      padding: 12px;
    }

    .ai-status-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .ai-chip {
      font-size: 0.6875rem;
      font-weight: 800;
      color: #00f2fe;
      background: rgba(0, 242, 254, 0.15);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .status-val {
      font-size: 0.75rem;
      color: #10b981;
    }

    .ai-status-desc {
      font-size: 0.75rem;
      color: var(--text-muted);
      line-height: 1.3;
      margin: 0;
    }

    .mobile-bottom-nav {
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60px;
      border-top: 1px solid var(--border-subtle);
      z-index: 100;
      justify-content: space-around;
      align-items: center;
      padding: 0 8px;
    }

    .mobile-nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: var(--text-muted);
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      transition: all 0.2s ease;
      text-decoration: none;
    }

    .mobile-nav-item.active {
      color: #00f2fe;
      transform: translateY(-2px);
    }

    .mobile-nav-item svg {
      transition: transform 0.2s ease;
    }
    .mobile-nav-item.active svg {
      stroke: #00f2fe;
      filter: drop-shadow(0 0 6px rgba(0, 242, 254, 0.5));
    }

    @media (max-width: 900px) {
      .desktop-sidebar {
        display: none;
      }
      .mobile-bottom-nav {
        display: flex;
      }
    }
  `]
})
export class NavMenuComponent implements OnInit {
  user: UserProfile | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(u => {
      this.user = u;
    });
  }
}
