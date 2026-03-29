import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  qbUrl: string;
  qbUsername: string;
  qbPassword: string;
  setQbConfig: (url: string, user: string, pass: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      qbUrl: 'http://127.0.0.1:8080',
      qbUsername: '',
      qbPassword: '',
      setQbConfig: (url, user, pass) => set({ qbUrl: url, qbUsername: user, qbPassword: pass }),
    }),
    {
      name: 'fg-manager-settings',
    }
  )
);
