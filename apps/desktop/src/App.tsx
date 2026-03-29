import { useEffect } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Toaster } from "sonner";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useGamesStore } from "@/store/useGamesStore";

import GamesCatalog from "@/routes/GamesCatalog";
import GameDetailView from "@/routes/GameDetailView";
import LibraryView from "@/routes/LibraryView";
import DownloadsView from "@/routes/DownloadsView";
import SettingsView from "@/routes/SettingsView";

export default function App() {
  const initDB = useGamesStore((s) => s.initDB);

  useEffect(() => {
    initDB();

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
