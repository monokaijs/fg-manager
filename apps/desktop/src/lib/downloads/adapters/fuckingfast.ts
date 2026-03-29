import { invoke } from '@tauri-apps/api/core';
import type { DownloaderAdapter, DownloadTask } from '../types';

export class FuckingFastAdapter implements DownloaderAdapter {
  id = 'fuckingfast';
  name = 'FuckingFast Multi-Part (Native)';

  async init() {
    return true; // Always available as it's native Rust
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async addMagnet(_magnet: string, _gameSlug?: string): Promise<boolean> {
    // This adapter only handles multipart HTTP URLs from fuckingfast.co, not magnets
    return false;
  }

  async addTorrent(_torrentUrl: string, _gameSlug?: string): Promise<boolean> {
    return false;
  }

  async addUrls(id: string, gameSlug: string, urls: string[]): Promise<boolean> {
    try {
      return await invoke<boolean>('ff_add_urls', { id, gameSlug, urls });
    } catch (e) {
      console.error("Failed to add fast URLs", e);
      return false;
    }
  }

  async pause(id: string): Promise<boolean> {
    try {
      await invoke('ff_pause', { id });
      return true;
    } catch {
      return false;
    }
  }

  async resume(id: string): Promise<boolean> {
    try {
      await invoke('ff_resume', { id });
      return true;
    } catch {
      return false;
    }
  }

  async remove(id: string, deleteFiles: boolean): Promise<boolean> {
    try {
      await invoke('ff_remove', { id, deleteFiles });
      return true;
    } catch {
      return false;
    }
  }

  async getTasks(): Promise<DownloadTask[]> {
    try {
      const stats = await invoke<any[]>('ff_get_tasks');
      return stats.map(s => ({
        id: s.id,
        gameSlug: s.game_slug,
        name: s.name,
        status: s.status,
        progress: s.progress,
        downloadSpeed: s.download_speed,
        uploadSpeed: 0,
        eta: s.eta,
        totalSize: s.total_size,
        downloaded: s.downloaded,
      }));
    } catch {
      return [];
    }
  }
}
