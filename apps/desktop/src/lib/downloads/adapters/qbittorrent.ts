import type { DownloaderAdapter, DownloadTask } from '../types';

import { useSettingsStore } from '../../../stores/settingsStore';

export class QBittorrentAdapter implements DownloaderAdapter {
  id = 'qbittorrent';
  name = 'qBittorrent (Local)';

  async init() {
    return this.isAvailable();
  }

  // To prevent CORS errors, we ideally use Tauri's native http fetch if installed, 
  // but fallback to standard fetch (since most local clients allow localhost origins).
  private async safeFetch(endpoint: string, options?: RequestInit) {
    const { qbUrl } = useSettingsStore.getState();
    const baseUrl = qbUrl.endsWith('/') ? qbUrl.slice(0, -1) : qbUrl;
    return window.fetch(`${baseUrl}${endpoint}`, options);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.safeFetch('/api/v2/app/version');
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  async addMagnet(magnet: string, gameSlug?: string): Promise<boolean> {
    try {
      const formData = new URLSearchParams();
      formData.append('urls', magnet);
      
      // Optional: attach fg-manager metadata
      if (gameSlug) {
        formData.append('category', 'fg-manager');
        formData.append('tags', gameSlug);
      }
      
      const res = await this.safeFetch('/api/v2/torrents/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      return res.ok || res.status === 200;
    } catch {
      return false;
    }
  }

  async addTorrent(torrentUrl: string, gameSlug?: string): Promise<boolean> {
    // qBittorrent can universally accept torrent HTTP URLs via the 'urls' payload
    return this.addMagnet(torrentUrl, gameSlug);
  }

  async pause(id: string): Promise<boolean> {
    try {
      const formData = new URLSearchParams(); 
      formData.append('hashes', id);
      const res = await this.safeFetch('/api/v2/torrents/pause', { 
        method: 'POST', 
        body: formData.toString(), 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return res.ok;
    } catch { return false; }
  }

  async resume(id: string): Promise<boolean> {
    try {
      const formData = new URLSearchParams(); 
      formData.append('hashes', id);
      const res = await this.safeFetch('/api/v2/torrents/resume', { 
        method: 'POST', 
        body: formData.toString(), 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return res.ok;
    } catch { return false; }
  }

  async remove(id: string, deleteFiles: boolean): Promise<boolean> {
    try {
      const formData = new URLSearchParams(); 
      formData.append('hashes', id);
      formData.append('deleteFiles', deleteFiles.toString());
      const res = await this.safeFetch('/api/v2/torrents/delete', { 
        method: 'POST', 
        body: formData.toString(), 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return res.ok;
    } catch { return false; }
  }

  private mapState(state: string, progress: number): DownloadTask['status'] {
    if (progress === 1) return 'completed';
    if (state.includes('downloading')) return 'downloading';
    if (state.includes('paused') || state === 'stoppedUP' || state === 'stoppedDL') return 'paused';
    if (state.includes('stalledDL')) return 'stalled';
    if (state.includes('uploading') || state.includes('stalledUP')) return 'completed';
    if (state.includes('checking')) return 'checking';
    if (state.includes('queued')) return 'queued';
    if (state.includes('error') || state.includes('missingFiles')) return 'error';
    return 'downloading';
  }

  async getTasks(): Promise<DownloadTask[]> {
    try {
      const res = await this.safeFetch('/api/v2/torrents/info');
      if (!res.ok) return [];
      const torrents = await res.json();
      
      return torrents
        .filter((t: any) => t.category === 'fg-manager' || t.tags?.includes('fg-manager'))
        .map((t: any) => ({
          id: t.hash,
          // Extract the first tag (usually gameSlug)
          gameSlug: t.tags ? t.tags.split(',')[0].trim() : undefined,
          name: t.name,
          status: this.mapState(t.state, t.progress),
          progress: t.progress,
          downloadSpeed: t.dlspeed,
          uploadSpeed: t.upspeed,
          eta: t.eta,
          totalSize: t.size,
          downloaded: t.downloaded
        }));
    } catch {
      return [];
    }
  }
}
