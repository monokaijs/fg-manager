import type { DownloaderAdapter, DownloadTask } from './types';
import { NativeAdapter } from './adapters/native';
import { QBittorrentAdapter } from './adapters/qbittorrent';
import { FuckingFastAdapter } from './adapters/fuckingfast';

class DownloadManager {
  private adapters: DownloaderAdapter[] = [];
  private activeAdapter: DownloaderAdapter | null = null;

  // Cache adapter availability to avoid redundant IPC/network calls every poll
  private availabilityCache: Map<string, { available: boolean; checkedAt: number }> = new Map();
  private readonly AVAILABILITY_TTL = 15000; // 15 seconds

  constructor() {
    this.registerAdapter(new NativeAdapter());
    this.registerAdapter(new QBittorrentAdapter());
    this.registerAdapter(new FuckingFastAdapter());
  }

  registerAdapter(adapter: DownloaderAdapter) {
    this.adapters.push(adapter);
  }

  private async isAdapterAvailable(adapter: DownloaderAdapter): Promise<boolean> {
    const cached = this.availabilityCache.get(adapter.id);
    const now = Date.now();
    if (cached && (now - cached.checkedAt) < this.AVAILABILITY_TTL) {
      return cached.available;
    }
    const available = await adapter.isAvailable();
    this.availabilityCache.set(adapter.id, { available, checkedAt: now });
    return available;
  }

  async getAvailableAdapters() {
    const available = [];
    for (const adapter of this.adapters) {
      if (await this.isAdapterAvailable(adapter)) {
        available.push(adapter);
      }
    }
    return available;
  }

  setActiveAdapter(adapterId: string) {
    const adapter = this.adapters.find(a => a.id === adapterId);
    if (adapter) this.activeAdapter = adapter;
  }

  getActiveAdapter() {
    return this.activeAdapter;
  }

  async autoConnect(): Promise<boolean> {
    const available = await this.getAvailableAdapters();
    if (available.length > 0) {
      // Pick the first available if none assigned natively
      if (!this.activeAdapter) {
        this.activeAdapter = available[0];
      }
      return true;
    }
    return false;
  }

  async addMagnet(magnet: string, gameSlug?: string) {
    if (!this.activeAdapter) {
      if (!(await this.autoConnect())) return false;
    }
    return this.activeAdapter!.addMagnet(magnet, gameSlug);
  }

  async addTorrent(url: string, gameSlug?: string) {
    if (!this.activeAdapter) {
      if (!(await this.autoConnect())) return false;
    }
    return this.activeAdapter!.addTorrent(url, gameSlug);
  }

  async addFastUrls(id: string, gameSlug: string, urls: string[]) {
    const adapter = this.adapters.find(a => a.id === 'fuckingfast') as FuckingFastAdapter | undefined;
    if (adapter && await this.isAdapterAvailable(adapter)) {
      return await adapter.addUrls(id, gameSlug, urls);
    }
    return false;
  }

  async pause(id: string) {
    for (const a of this.adapters) { 
      try { await a.pause(id); } catch(e) {}
    }
    return true;
  }

  async resume(id: string) {
    for (const a of this.adapters) {
       try { await a.resume(id); } catch(e) {}
    }
    return true;
  }

  async remove(id: string, deleteFiles: boolean) {
    for (const a of this.adapters) {
       try { await a.remove(id, deleteFiles); } catch(e) {}
    }
    return true;
  }

  async getTasks(): Promise<DownloadTask[]> {
    // Check availability first (uses cache, fast)
    const available: DownloaderAdapter[] = [];
    for (const adapter of this.adapters) {
      if (await this.isAdapterAvailable(adapter)) {
        available.push(adapter);
      }
    }
    // Poll all available adapters in PARALLEL to avoid serial IPC blocking
    const results = await Promise.allSettled(
      available.map(a => a.getTasks())
    );
    const unifiedTasks: DownloadTask[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') unifiedTasks.push(...r.value);
    }
    return unifiedTasks;
  }
}

export const downloadManager = new DownloadManager();
