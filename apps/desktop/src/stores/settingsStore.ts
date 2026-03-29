import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { enable, disable } from '@tauri-apps/plugin-autostart';
import { invoke } from '@tauri-apps/api/core';

interface SettingsState {
  qbUrl: string;
  qbUsername: string;
  qbPassword: string;
  setQbConfig: (url: string, user: string, pass: string) => void;
  downloadPath: string | null;
  setDownloadPath: (path: string) => void;
  startWithWindows: boolean;
  setStartWithWindows: (val: boolean) => Promise<void>;
  hideOnStartup: boolean;
  setHideOnStartup: (val: boolean) => void;
  downloadSpeedLimit: number; // in KB/s, 0 = unlimited
  setDownloadSpeedLimit: (val: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      qbUrl: 'http://127.0.0.1:8080',
      qbUsername: '',
      qbPassword: '',
      setQbConfig: (url, user, pass) => set({ qbUrl: url, qbUsername: user, qbPassword: pass }),
      downloadPath: null,
      setDownloadPath: (path) => set({ downloadPath: path }),
      startWithWindows: false,
      setStartWithWindows: async (val) => {
        try {
          if (val) await enable();
          else await disable();
          set({ startWithWindows: val });
        } catch (e) {
          console.error("Failed to toggle autostart:", e);
        }
      },
      hideOnStartup: false,
      setHideOnStartup: (val) => set({ hideOnStartup: val }),
      downloadSpeedLimit: 0,
      setDownloadSpeedLimit: (val) => {
        set({ downloadSpeedLimit: val });
        invoke('set_download_speed_limit', { limitKbps: val }).catch(console.error);
      },
    }),
    {
      name: 'fg-manager-settings',
    }
  )
);
