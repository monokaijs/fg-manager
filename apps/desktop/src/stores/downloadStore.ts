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

// Fast shallow comparison of task arrays to avoid unnecessary React re-renders.
// This is the critical fix: without this, every 2s poll creates a new array reference
// and Zustand triggers re-renders across the ENTIRE component tree.
function tasksChanged(prev: DownloadTask[], next: DownloadTask[]): boolean {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i], b = next[i];
    if (
      a.id !== b.id ||
      a.status !== b.status ||
      a.progress !== b.progress ||
      a.downloadSpeed !== b.downloadSpeed ||
      a.downloaded !== b.downloaded ||
      a.eta !== b.eta ||
      a.gameSlug !== b.gameSlug
    ) return true;
  }
  return false;
}

let isRefreshing = false;

export const useDownloadStore = create<DownloadState>((set, get) => ({
  tasks: [],
  adapterId: null,

  setAdapter: (id) => {
    downloadManager.setActiveAdapter(id);
    set({ adapterId: id });
  },

  refreshTasks: async () => {
    // Prevent overlapping refreshes from stacking up IPC calls
    if (isRefreshing) return;
    isRefreshing = true;

    try {
      const active = downloadManager.getActiveAdapter();
      if (active) {
        const newTasks = await downloadManager.getTasks();
        const prev = get().tasks;
        if (tasksChanged(prev, newTasks)) {
          set({ tasks: newTasks });
        }
      } else {
        const hasAdapter = await downloadManager.autoConnect();
        if (hasAdapter) {
          set({ adapterId: downloadManager.getActiveAdapter()?.id });
          const newTasks = await downloadManager.getTasks();
          const prev = get().tasks;
          if (tasksChanged(prev, newTasks)) {
            set({ tasks: newTasks });
          }
        }
      }
    } finally {
      isRefreshing = false;
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

// Global polling — use adaptive interval:
// 3s when there are active downloads, 10s when idle
let pollTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePoll() {
  const tasks = useDownloadStore.getState().tasks;
  const hasActive = tasks.some(t => t.status === 'downloading' || t.status === 'checking' || t.status === 'extracting');
  const interval = hasActive ? 3000 : 10000;

  pollTimer = setTimeout(async () => {
    await useDownloadStore.getState().refreshTasks();
    schedulePoll();
  }, interval);
}

schedulePoll();
