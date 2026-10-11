/**
 * Network Connectivity Monitor
 * Tracks browser online status and server reachability.
 */

type ConnectivityListener = (isOnline: boolean) => void;

class ConnectivityManager {
  private online: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners: Set<ConnectivityListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleStatusChange(true));
      window.addEventListener('offline', () => this.handleStatusChange(false));
    }
  }

  private handleStatusChange(status: boolean): void {
    this.online = status;
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch {
        // Safe dispatch
      }
    }
  }

  public isOnline(): boolean {
    return this.online;
  }

  public subscribe(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setOnline(status: boolean): void {
    this.handleStatusChange(status);
  }
}

export const connectivity = new ConnectivityManager();
