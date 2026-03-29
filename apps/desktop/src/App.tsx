import { useEffect } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Toaster, toast } from "sonner";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { check } from "@tauri-apps/plugin-updater";
import { useGamesStore } from "@/store/useGamesStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { formatBytes } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";

import GamesCatalog from "@/routes/GamesCatalog";
import GameDetailView from "@/routes/GameDetailView";
import LibraryView from "@/routes/LibraryView";
import DownloadsView from "@/routes/DownloadsView";
import SettingsView from "@/routes/SettingsView";

export default function App() {
  const initDB = useGamesStore((s) => s.initDB);

  useEffect(() => {
    initDB();

    // Autostart logic
    invoke<boolean>("check_autostart_hidden").then((isHiddenArg) => {
        const { hideOnStartup, downloadSpeedLimit } = useSettingsStore.getState();
        // Sync download limit
        invoke('set_download_speed_limit', { limitKbps: downloadSpeedLimit }).catch(console.error);

        if (isHiddenArg && hideOnStartup) {
             getCurrentWindow().hide();
        }
    });

    // Check for Updates automatically
    check().then(async (update) => {
      if (update?.available) {
        const toastId = toast.loading(`Downloading update ${update.version}: Starting...`);
        let downloaded = 0;
        let total = 0;

        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              total = event.data.contentLength || 0;
              break;
            case 'Progress':
              downloaded += event.data.chunkLength;
              if (total > 0) {
                toast.loading(`Downloading update ${update.version}: ${Math.round((downloaded / total) * 100)}%`, { id: toastId });
              } else {
                toast.loading(`Downloading update ${update.version}: ${formatBytes(downloaded)}...`, { id: toastId });
              }
              break;
            case 'Finished':
              toast.loading(`Installing update ${update.version}...`, { id: toastId });
              break;
          }
        });
        toast.success(`Update ${update.version} installed! Please restart the application to apply.`, { id: toastId, duration: Infinity });
      }
    }).catch(err => console.error("Update check failed:", err));

    // Track maximized state for border styling
    const win = getCurrentWindow();
    let unlistenResize: () => void;

    const updateMaximizedClass = async () => {
      document.documentElement.classList.toggle('maximized', await win.isMaximized());
    };

    updateMaximizedClass();
    win.onResized(updateMaximizedClass).then(unlisten => {
      unlistenResize = unlisten;
    });

    return () => {
      if (unlistenResize) unlistenResize();
    };
  }, [initDB]);

  return (
    <Router>
      <SidebarProvider className="font-sans h-full w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="bg-background relative flex-1 overflow-y-auto overflow-x-hidden h-full flex-col">
          <Routes>
            <Route path="/library" element={<LibraryView />} />
            <Route path="/games" element={<GamesCatalog />} />
            <Route path="/favorites" element={<GamesCatalog filter="favorites" />} />
            <Route path="/games/view/:slug" element={<GameDetailView />} />
            <Route path="/downloads" element={<DownloadsView />} />
            <Route path="/settings" element={<SettingsView />} />
            {/* Fallback to games catalog */}
            <Route path="/" element={<GamesCatalog />} />
            <Route path="*" element={<GamesCatalog />} />
          </Routes>
        </SidebarInset>
      </SidebarProvider>
      <Toaster position="bottom-right" richColors />
    </Router>
  );
}
