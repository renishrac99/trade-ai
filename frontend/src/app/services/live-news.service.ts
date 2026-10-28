import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { LiveNewsItem } from '../models/trade.models';

@Injectable({
  providedIn: 'root'
})
export class LiveNewsService {
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private maxItems = 15;

  private newsListSubject = new BehaviorSubject<LiveNewsItem[]>([]);
  public newsList$: Observable<LiveNewsItem[]> = this.newsListSubject.asObservable();

  private newArrivalSubject = new Subject<LiveNewsItem>();
  public newArrival$: Observable<LiveNewsItem> = this.newArrivalSubject.asObservable();

  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$: Observable<boolean> = this.isConnectedSubject.asObservable();

  private isWidgetOpenSubject = new BehaviorSubject<boolean>(false);
  public isWidgetOpen$: Observable<boolean> = this.isWidgetOpenSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$: Observable<number> = this.unreadCountSubject.asObservable();

  constructor(
    private ngZone: NgZone,
    private http: HttpClient
  ) {
    this.connect();
  }

  public get isWidgetOpen(): boolean {
    return this.isWidgetOpenSubject.value;
  }

  public toggleWidget(): void {
    const nextState = !this.isWidgetOpenSubject.value;
    this.isWidgetOpenSubject.next(nextState);
    if (nextState) {
      this.unreadCountSubject.next(0);
    }
  }

  public openWidget(): void {
    this.isWidgetOpenSubject.next(true);
    this.unreadCountSubject.next(0);
  }

  public closeWidget(): void {
    this.isWidgetOpenSubject.next(false);
  }

  public markAllRead(): void {
    this.unreadCountSubject.next(0);
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const host = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'localhost:8000'
      : window.location.host;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${host}/api/news/live`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.ngZone.run(() => {
          this.isConnectedSubject.next(true);
          clearTimeout(this.reconnectTimer);
        });
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.ngZone.run(() => {
          try {
            const data: LiveNewsItem = JSON.parse(event.data);
            this.handleIncomingNews(data);
          } catch (e) {
            console.error('[LiveNewsService] Failed to parse news JSON:', e);
          }
        });
      };

      this.ws.onclose = () => {
        this.ngZone.run(() => {
          this.isConnectedSubject.next(false);
          this.scheduleReconnect();
        });
      };

      this.ws.onerror = (err) => {
        this.ngZone.run(() => {
          console.warn('[LiveNewsService] WebSocket error, attempting HTTP backfill:', err);
          this.fetchHttpFallback();
          this.ws?.close();
        });
      };
    } catch (err) {
      console.warn('[LiveNewsService] WebSocket connection error:', err);
      this.scheduleReconnect();
      this.fetchHttpFallback();
    }
  }

  private handleIncomingNews(item: LiveNewsItem): void {
    const currentList = this.newsListSubject.value;
    // Check if this item is already present (dedup by headline)
    const exists = currentList.some(n => n.headline === item.headline);
    if (!exists) {
      const updatedList = [item, ...currentList].slice(0, this.maxItems);
      this.newsListSubject.next(updatedList);
      this.newArrivalSubject.next(item);

      if (!this.isWidgetOpenSubject.value) {
        this.unreadCountSubject.next(this.unreadCountSubject.value + 1);
      }
    }
  }

  private scheduleReconnect(): void {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 5000);
  }

  public fetchHttpFallback(): void {
    const host = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:8000'
      : '';
    this.http.get<{ count: number; news: LiveNewsItem[] }>(`${host}/api/news/history`)
      .subscribe({
        next: (resp) => {
          if (resp && resp.news && resp.news.length > 0) {
            const current = this.newsListSubject.value;
            const merged = [...resp.news, ...current];
            const unique = Array.from(new Map(merged.map(m => [m.headline, m])).values()).slice(0, this.maxItems);
            this.newsListSubject.next(unique);
          }
        },
        error: (err) => {
          console.warn('[LiveNewsService] HTTP fallback error:', err);
        }
      });
  }

  public disconnect(): void {
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
