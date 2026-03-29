import { create } from 'zustand';
import type { DownloadTask } from '../lib/downloads/types';
import { downloadManager } from '../lib/downloads/manager';

interface DownloadState {
  tasks: DownloadTask[];
  adapterId: string | null;
  setAdapter: (id: string) => void;
  refreshTasks: () => Promise<void>;
  addMagnet: (magnet: string, gameSlug?: string) => Promise<boolean>;
  addTorrent: (url: string, gameSlug?: string) => Promise<boolean>;
  addFastUrls: (id: string, gameSlug: string, urls: string[]) => Promise<boolean>;
  pause: (id: string) => Promise<void>;
  resume: (id: string) => Promise<void>;
  remove: (id: string, deleteFiles: boolean) => Promise<void>;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  tasks: [],
  adapterId: null,
  
  setAdapter: (id) => {
    downloadManager.setActiveAdapter(id);
    set({ adapterId: id });
  },
  
  refreshTasks: async () => {
    const active = downloadManager.getActiveAdapter();
    if (active) {
      const tasks = await downloadManager.getTasks();
      set({ tasks });
    } else {
      // Try to auto-connect just in case qBittorrent boots up recently
      const hasAdapter = await downloadManager.autoConnect();
      if (hasAdapter) {
        set({ adapterId: downloadManager.getActiveAdapter()?.id });
        const tasks = await downloadManager.getTasks();
        set({ tasks });
      }
    }
  },

  addMagnet: async (magnet, slug) => {
    return downloadManager.addMagnet(magnet, slug);
  },

  addTorrent: async (url, slug) => {
    return downloadManager.addTorrent(url, slug);
  },

  addFastUrls: async (id, slug, urls) => {
    return downloadManager.addFastUrls(id, slug, urls);
  },
  
  pause: async (id) => {
    await downloadManager.pause(id);
    get().refreshTasks();
  },
  resume: async (id) => {
    await downloadManager.resume(id);
    get().refreshTasks();
  },
  remove: async (id, del) => {
    await downloadManager.remove(id, del);
    get().refreshTasks();
  }
}));

// Global polling block
setInterval(() => {
  useDownloadStore.getState().refreshTasks();
}, 2000);
