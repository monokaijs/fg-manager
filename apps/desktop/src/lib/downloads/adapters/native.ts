import { invoke } from '@tauri-apps/api/core';
import type { DownloaderAdapter, DownloadTask } from '../types';
import { useSettingsStore } from '../../../stores/settingsStore';

export class NativeAdapter implements DownloaderAdapter {
  id = 'native';
  name = 'Native Rust Engine (librqbit)';

  async init() {
    return this.isAvailable();
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Handshake with our embedded Rust engine
      const res: string = await invoke('torrent_ping');
      return res === 'pong';
    } catch (e) {
      return false;
    }
  }

  async addMagnet(magnet: string, gameSlug?: string): Promise<boolean> {
    try {
      const { downloadPath } = useSettingsStore.getState();
      await invoke('torrent_add_magnet', { magnet, gameSlug, downloadDir: downloadPath });
      return true;
    } catch (e) {
      console.error("Native adapter addMagnet error:", e);
      return false;
    }
  }

  async addTorrent(torrentUrl: string, gameSlug?: string): Promise<boolean> {
    try {
      const { downloadPath } = useSettingsStore.getState();
      await invoke('torrent_add_url', { url: torrentUrl, gameSlug, downloadDir: downloadPath });
      return true;
    } catch {
      return false;
    }
  }

  async pause(id: string): Promise<boolean> {
    try {
      await invoke('torrent_pause', { id });
      return true;
    } catch {
      return false;
    }
  }

  async resume(id: string): Promise<boolean> {
    try {
      await invoke('torrent_resume', { id });
      return true;
    } catch {
      return false;
    }
  }

  async remove(id: string, deleteFiles: boolean): Promise<boolean> {
    try {
      await invoke('torrent_remove', { id, deleteFiles });
      return true;
    } catch {
      return false;
    }
  }

  async getTasks(): Promise<DownloadTask[]> {
    try {
      // The Rust backend returns an array mapping our DownloadTask shape
      const tasks: DownloadTask[] = await invoke('torrent_get_tasks');
      return tasks;
    } catch {
      return [];
    }
  }
}
