import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { enable, disable } from '@tauri-apps/plugin-autostart';

interface SettingsState {
  language: 'en' | 'vi';
  setLanguage: (language: 'en' | 'vi') => void;
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
  minimizeToTrayOnClose: boolean;
  setMinimizeToTrayOnClose: (val: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language }),
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
      setDownloadSpeedLimit: (val) => set({ downloadSpeedLimit: val }),
      minimizeToTrayOnClose: true,
      setMinimizeToTrayOnClose: (val) => set({ minimizeToTrayOnClose: val }),
    }),
    {
      name: 'fg-manager-settings',
    }
  )
);
