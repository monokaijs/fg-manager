import { create } from 'zustand';
import type { DownloadTask } from '../lib/downloads/types';
import { downloadManager } from '../lib/downloads/manager';
import { useSettingsStore } from './settingsStore';

type TaskStatus = DownloadTask['status'];

const ACTIVE_STATUSES: TaskStatus[] = ['downloading', 'checking', 'extracting', 'installing'];
const TERMINAL_STATUSES: TaskStatus[] = ['completed', 'error'];

function isTerminalStatus(status: TaskStatus) {
  return TERMINAL_STATUSES.includes(status);
}

function isActiveStatus(status: TaskStatus) {
  return ACTIVE_STATUSES.includes(status);
}

function normalizeQueueOrder(queueOrder: string[], tasks: DownloadTask[]): string[] {
  const queueTaskIds = tasks.filter((task) => !isTerminalStatus(task.status)).map((task) => task.id);
  const normalized = queueOrder.filter((id, index) => queueTaskIds.includes(id) && queueOrder.indexOf(id) === index);
  for (const id of queueTaskIds) {
    if (!normalized.includes(id)) normalized.push(id);
  }
  return normalized;
}

function sortTasksByQueue(tasks: DownloadTask[], queueOrder: string[]): DownloadTask[] {
  const indexMap = new Map(queueOrder.map((id, index) => [id, index]));
  return [...tasks].sort((a, b) => {
    const aTerminal = isTerminalStatus(a.status);
    const bTerminal = isTerminalStatus(b.status);
    if (aTerminal !== bTerminal) return aTerminal ? 1 : -1;

    const aIndex = indexMap.has(a.id) ? indexMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const bIndex = indexMap.has(b.id) ? indexMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;

    return a.name.localeCompare(b.name);
  });
}

interface DownloadState {
  tasks: DownloadTask[];
  queueOrder: string[];
  manuallyPausedIds: string[];
  adapterId: string | null;
  setAdapter: (id: string) => void;
  refreshTasks: () => Promise<void>;
  addMagnet: (magnet: string, gameSlug?: string) => Promise<boolean>;
  addTorrent: (url: string, gameSlug?: string) => Promise<boolean>;
  addFastUrls: (id: string, gameSlug: string, urls: string[]) => Promise<boolean>;
  pause: (id: string) => Promise<void>;
  resume: (id: string) => Promise<void>;
  remove: (id: string, deleteFiles: boolean) => Promise<void>;
  moveQueueItem: (id: string, direction: 'up' | 'down') => void;
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
      a.gameSlug !== b.gameSlug ||
      a.savePath !== b.savePath
    ) return true;
  }
  return false;
}

let isRefreshing = false;
let isQueueOrchestrating = false;
let lastAppliedSpeedLimit: number | null = null;

async function enforceSingleActiveQueue(tasks: DownloadTask[], queueOrder: string[], manuallyPausedIds: string[]) {
  if (isQueueOrchestrating) return;
  isQueueOrchestrating = true;

  try {
    const pausedSet = new Set(manuallyPausedIds);
    const actionable = tasks.filter((task) => !isTerminalStatus(task.status) && !pausedSet.has(task.id));
    const activeByOrder = queueOrder.filter((id) => actionable.some((task) => task.id === id));
    const preferredId = activeByOrder[0];
    const activeNow = actionable.filter((task) => isActiveStatus(task.status));

    for (const task of activeNow) {
      if (!preferredId || task.id !== preferredId) {
        await downloadManager.pause(task.id);
      }
    }

    if (preferredId) {
      const preferredTask = actionable.find((task) => task.id === preferredId);
      if (preferredTask && !isActiveStatus(preferredTask.status)) {
        await downloadManager.resume(preferredId);
      }
    }
  } finally {
    isQueueOrchestrating = false;
  }
}

async function syncSpeedLimitIfNeeded() {
  const limit = Math.max(0, Math.floor(useSettingsStore.getState().downloadSpeedLimit || 0));
  if (lastAppliedSpeedLimit === limit) return;
  lastAppliedSpeedLimit = limit;
  await downloadManager.setDownloadSpeedLimit(limit);
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  tasks: [],
  queueOrder: [],
  manuallyPausedIds: [],
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
      await syncSpeedLimitIfNeeded();

      const active = downloadManager.getActiveAdapter();
      let fetchedTasks: DownloadTask[] = [];

      if (active) {
        fetchedTasks = await downloadManager.getTasks();
      } else {
        const hasAdapter = await downloadManager.autoConnect();
        if (hasAdapter) {
          set({ adapterId: downloadManager.getActiveAdapter()?.id });
          fetchedTasks = await downloadManager.getTasks();
        }
      }

      const prev = get().tasks;
      const prevQueue = get().queueOrder;
      const normalizedQueueOrder = normalizeQueueOrder(prevQueue, fetchedTasks);
      const sortedTasks = sortTasksByQueue(fetchedTasks, normalizedQueueOrder);

      const queueChanged = normalizedQueueOrder.length !== prevQueue.length
        || normalizedQueueOrder.some((id, index) => prevQueue[index] !== id);

      if (tasksChanged(prev, sortedTasks) || queueChanged) {
        set({ tasks: sortedTasks, queueOrder: normalizedQueueOrder });
      }

      await enforceSingleActiveQueue(sortedTasks, normalizedQueueOrder, get().manuallyPausedIds);
    } finally {
      isRefreshing = false;
    }
  },

  addMagnet: async (magnet, slug) => {
    const success = await downloadManager.addMagnet(magnet, slug);
    if (success) get().refreshTasks();
    return success;
  },

  addTorrent: async (url, slug) => {
    const success = await downloadManager.addTorrent(url, slug);
    if (success) get().refreshTasks();
    return success;
  },

  addFastUrls: async (id, slug, urls) => {
    const success = await downloadManager.addFastUrls(id, slug, urls);
    if (success) get().refreshTasks();
    return success;
  },

  pause: async (id) => {
    set((state) => ({
      manuallyPausedIds: state.manuallyPausedIds.includes(id)
        ? state.manuallyPausedIds
        : [...state.manuallyPausedIds, id],
    }));
    await downloadManager.pause(id);
    await get().refreshTasks();
  },
  resume: async (id) => {
    set((state) => ({
      manuallyPausedIds: state.manuallyPausedIds.filter((taskId) => taskId !== id),
      queueOrder: [id, ...state.queueOrder.filter((taskId) => taskId !== id)],
    }));
    await downloadManager.resume(id);
    await get().refreshTasks();
  },
  remove: async (id, del) => {
    set((state) => ({
      queueOrder: state.queueOrder.filter((taskId) => taskId !== id),
      manuallyPausedIds: state.manuallyPausedIds.filter((taskId) => taskId !== id),
    }));
    await downloadManager.remove(id, del);
    await get().refreshTasks();
  },
  moveQueueItem: (id, direction) => {
    set((state) => {
      const queueOrder = [...state.queueOrder];
      const index = queueOrder.indexOf(id);
      if (index === -1) return state;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= queueOrder.length) return state;

      const [item] = queueOrder.splice(index, 1);
      queueOrder.splice(targetIndex, 0, item);

      return {
        ...state,
        queueOrder,
        tasks: sortTasksByQueue(state.tasks, queueOrder),
      };
    });
  },
}));

// Global polling — use adaptive interval:
// 1s when there are active downloads, 10s when idle
function schedulePoll() {
  const tasks = useDownloadStore.getState().tasks;
  const hasActive = tasks.some((task) => isActiveStatus(task.status));
  const interval = hasActive ? 1000 : 10000;

  setTimeout(async () => {
    await useDownloadStore.getState().refreshTasks();
    schedulePoll();
  }, interval);
}

schedulePoll();
