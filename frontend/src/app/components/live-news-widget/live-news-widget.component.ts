import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { LiveNewsService } from '../../services/live-news.service';
import { LiveNewsItem } from '../../models/trade.models';

@Component({
  selector: 'app-live-news-widget',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Floating News Hub Toggle Button with Pulse Badge -->
    <button
      id="toggleNewsBtn"
      class="news-toggle-btn"
      [class.active]="isOpen"
      (click)="toggleWidget()"
      title="Live Market News & AI Intelligence"
    >
      <span class="icon-news">📰</span>
      <span *ngIf="unreadCount > 0 && !isOpen" class="unread-pill">{{ unreadCount }}</span>
      <span class="live-beacon-indicator" [class.beacon-online]="isConnected"></span>
    </button>

    <!-- Glassmorphism Live News HUD Card -->
    <div
      id="liveNewsWidget"
      class="live-news-corner"
      [class.show]="isOpen"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
    >
      <!-- Widget Header -->
      <div class="news-header">
        <div class="pulse-container">
          <div class="pulse" [class.pulse-offline]="!isConnected"></div>
          <span class="header-title">Live AI Market Intel</span>
          <span class="connection-tag" [class.tag-online]="isConnected">
            {{ isConnected ? 'LIVE' : 'SYNCING' }}
          </span>
        </div>
        <button id="closeNewsBtn" class="close-btn" (click)="closeWidget()" title="Dismiss HUD">✕</button>
      </div>

      <!-- Sentiment Filter Tabs -->
      <div class="sentiment-tabs">
        <button
          class="tab-btn"
          [class.active]="filter === 'ALL'"
          (click)="setFilter('ALL')"
        >
          All ({{ allNews.length }})
        </button>
        <button
          class="tab-btn tab-bullish"
          [class.active]="filter === 'bullish'"
          (click)="setFilter('bullish')"
        >
          Bullish ({{ countByImpact('bullish') }})
        </button>
        <button
          class="tab-btn tab-bearish"
          [class.active]="filter === 'bearish'"
          (click)="setFilter('bearish')"
        >
          Bearish ({{ countByImpact('bearish') }})
        </button>
      </div>

      <!-- News Feed Container -->
      <div id="newsFeed" class="news-feed-scroll">
        <div *ngIf="filteredNews.length === 0" class="empty-feed">
          <div class="empty-icon">📡</div>
          <div class="empty-text">
            {{ isConnected ? 'Streaming incoming intelligence feeds...' : 'Connecting to live RSS poller...' }}
          </div>
        </div>

        <div
          *ngFor="let item of filteredNews; trackBy: trackHeadline"
          class="news-item"
        >
          <div class="news-meta">
            <span class="asset-chip">{{ item.analysis?.asset || 'MARKET' }}</span>
            <span *ngIf="item.time" class="time-stamp">{{ item.time }}</span>
            <span
              class="news-impact"
              [ngClass]="getImpactClass(item.analysis?.impact)"
            >
              <span class="impact-indicator">{{ getImpactIcon(item.analysis?.impact) }}</span>
              {{ (item.analysis?.impact || 'neutral') | uppercase }}
            </span>
          </div>

          <div class="news-headline">
            {{ item.headline }}
          </div>

          <div class="news-footer" *ngIf="item.analysis?.reason">
            <span class="reason-tag">
              <span class="reason-label">AI Driver:</span> {{ item.analysis?.reason }}
            </span>
            <a
              *ngIf="item.link"
              [href]="item.link"
              target="_blank"
              rel="noopener noreferrer"
              class="read-link"
              title="Read full article"
            >
              Source ↗
            </a>
          </div>
        </div>
      </div>

      <!-- Card Footer Bar -->
      <div class="news-card-footer">
        <span class="footer-note">⚡ Real-time Google Gemini + Financial RSS Feeds</span>
        <button class="action-btn" (click)="refreshFeed()" title="Refresh News Feed">↻</button>
      </div>
    </div>
  `,
  styles: [`
    /* Floating Toggle Button */
    .news-toggle-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      width: 54px;
      height: 54px;
      font-size: 24px;
      box-shadow: 0 8px 24px rgba(37, 99, 235, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1);
      cursor: pointer;
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .news-toggle-btn:hover {
      transform: scale(1.08) translateY(-2px);
      box-shadow: 0 12px 28px rgba(37, 99, 235, 0.6);
    }

    .news-toggle-btn.active {
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
    }

    .icon-news {
      font-size: 24px;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
    }

    /* Unread Counter Badge */
    .unread-pill {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: white;
      font-size: 11px;
      font-weight: 700;
      border-radius: 12px;
      padding: 1px 6px;
      border: 2px solid #0f172a;
      box-shadow: 0 2px 6px rgba(239, 68, 68, 0.6);
      animation: bounce 1s infinite alternate;
    }

    @keyframes bounce {
      0% { transform: translateY(0); }
      100% { transform: translateY(-3px); }
    }

    /* Online status beacon on toggle button */
    .live-beacon-indicator {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #64748b;
      border: 2px solid #0f172a;
    }

    .live-beacon-indicator.beacon-online {
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
    }

    /* Glassmorphism Corner Card HUD */
    .live-news-corner {
      position: fixed;
      bottom: 90px;
      right: 24px;
      width: 380px;
      max-width: calc(100vw - 32px);
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
      padding: 16px;
      transform: translateX(125%) scale(0.95);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.35s ease;
      z-index: 9999;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      box-sizing: border-box;
    }

    .live-news-corner.show {
      transform: translateX(0) scale(1);
      opacity: 1;
      pointer-events: auto;
    }

    /* Header styling */
    .news-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .pulse-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #f1f5f9;
      text-transform: uppercase;
    }

    .connection-tag {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 10px;
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .connection-tag.tag-online {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 15px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    /* Animated Live Pulse Dot */
    .pulse {
      width: 8px;
      height: 8px;
      background-color: #10b981;
      border-radius: 50%;
      animation: pulse-animation 2s infinite;
    }

    .pulse.pulse-offline {
      background-color: #f59e0b;
      animation: none;
    }

    @keyframes pulse-animation {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 7px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    /* Sentiment Filter Tabs */
    .sentiment-tabs {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
    }

    .tab-btn {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #94a3b8;
      font-size: 11px;
      font-weight: 600;
      padding: 5px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .tab-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #e2e8f0;
    }

    .tab-btn.active {
      background: rgba(59, 130, 246, 0.25);
      border-color: #3b82f6;
      color: #60a5fa;
    }

    .tab-btn.tab-bullish.active {
      background: rgba(16, 185, 129, 0.2);
      border-color: #10b981;
      color: #34d399;
    }

    .tab-btn.tab-bearish.active {
      background: rgba(239, 68, 68, 0.2);
      border-color: #ef4444;
      color: #f87171;
    }

    /* Feed Scroll Area */
    .news-feed-scroll {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 380px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .news-feed-scroll::-webkit-scrollbar {
      width: 4px;
    }
    .news-feed-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .news-feed-scroll::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }

    /* Empty state */
    .empty-feed {
      text-align: center;
      padding: 30px 10px;
      color: #64748b;
    }
    .empty-icon {
      font-size: 28px;
      margin-bottom: 8px;
    }
    .empty-text {
      font-size: 12px;
    }

    /* News Item Card */
    .news-item {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 10px 12px;
      transition: all 0.2s ease;
    }

    .news-item:hover {
      background: rgba(30, 41, 59, 0.95);
      border-color: rgba(255, 255, 255, 0.12);
      transform: translateY(-1px);
    }

    .news-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }

    .asset-chip {
      background: rgba(59, 130, 246, 0.15);
      color: #93c5fd;
      border: 1px solid rgba(59, 130, 246, 0.3);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }

    .time-stamp {
      font-size: 10px;
      color: #64748b;
      margin-right: auto;
    }

    .news-impact {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 7px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }

    .impact-bullish {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .impact-bearish {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .impact-neutral {
      background: rgba(148, 163, 184, 0.15);
      color: #cbd5e1;
      border: 1px solid rgba(148, 163, 184, 0.3);
    }

    .news-headline {
      font-size: 12px;
      font-weight: 600;
      color: #f8fafc;
      line-height: 1.45;
      margin-bottom: 6px;
    }

    .news-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
      padding-top: 4px;
      border-top: 1px dashed rgba(255, 255, 255, 0.05);
    }

    .reason-tag {
      color: #cbd5e1;
    }

    .reason-label {
      color: #64748b;
    }

    .read-link {
      color: #60a5fa;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }

    .read-link:hover {
      color: #93c5fd;
      text-decoration: underline;
    }

    /* Footer info */
    .news-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 10px;
      color: #64748b;
    }

    .action-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 13px;
      padding: 2px 6px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .action-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }
  `]
})
export class LiveNewsWidgetComponent implements OnInit, OnDestroy {
  isOpen = false;
  isConnected = false;
  unreadCount = 0;
  filter: 'ALL' | 'bullish' | 'bearish' = 'ALL';
  allNews: LiveNewsItem[] = [];

  private hideTimeout: any = null;
  private isHovered = false;
  private subs: Subscription[] = [];

  constructor(private newsService: LiveNewsService) {}

  ngOnInit(): void {
    this.subs.push(
      this.newsService.newsList$.subscribe((list) => {
        this.allNews = list;
      }),
      this.newsService.newArrival$.subscribe((_item) => {
        this.onNewArrival();
      }),
      this.newsService.isConnected$.subscribe((connected) => {
        this.isConnected = connected;
      }),
      this.newsService.isWidgetOpen$.subscribe((open) => {
        this.isOpen = open;
      }),
      this.newsService.unreadCount$.subscribe((count) => {
        this.unreadCount = count;
      })
    );
  }

  ngOnDestroy(): void {
    clearTimeout(this.hideTimeout);
    this.subs.forEach(s => s.unsubscribe());
  }

  get filteredNews(): LiveNewsItem[] {
    if (this.filter === 'ALL') return this.allNews;
    return this.allNews.filter(
      n => (n.analysis?.impact || 'neutral').toLowerCase() === this.filter
    );
  }

  setFilter(filter: 'ALL' | 'bullish' | 'bearish'): void {
    this.filter = filter;
  }

  countByImpact(impact: 'bullish' | 'bearish'): number {
    return this.allNews.filter(
      n => (n.analysis?.impact || 'neutral').toLowerCase() === impact
    ).length;
  }

  toggleWidget(): void {
    this.newsService.toggleWidget();
    clearTimeout(this.hideTimeout);
  }

  closeWidget(): void {
    this.newsService.closeWidget();
    clearTimeout(this.hideTimeout);
  }

  refreshFeed(): void {
    this.newsService.fetchHttpFallback();
  }

  onMouseEnter(): void {
    this.isHovered = true;
    clearTimeout(this.hideTimeout);
  }

  onMouseLeave(): void {
    this.isHovered = false;
    // If auto-hide was in progress, set a gentle 8s timeout to dismiss
    if (this.isOpen) {
      this.hideTimeout = setTimeout(() => {
        if (!this.isHovered) {
          this.newsService.closeWidget();
        }
      }, 8000);
    }
  }

  private onNewArrival(): void {
    // Pop open the widget with auto-hide after 12s unless hovered
    this.newsService.openWidget();
    clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => {
      if (!this.isHovered) {
        this.newsService.closeWidget();
      }
    }, 12000);
  }

  getImpactClass(impact?: string): string {
    const imp = (impact || 'neutral').toLowerCase();
    if (imp === 'bullish') return 'impact-bullish';
    if (imp === 'bearish') return 'impact-bearish';
    return 'impact-neutral';
  }

  getImpactIcon(impact?: string): string {
    const imp = (impact || 'neutral').toLowerCase();
    if (imp === 'bullish') return '▲';
    if (imp === 'bearish') return '▼';
    return '●';
  }

  trackHeadline(_index: number, item: LiveNewsItem): string {
    return item.headline;
  }
}
