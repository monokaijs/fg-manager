import { Download } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDownloadStore } from "@/stores/downloadStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useGamesStore } from "@/store/useGamesStore";
import { DownloadTaskRow } from "@/components/download-task-row";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/useI18n";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { DownloadTask } from "@/lib/downloads/types";

export default function DownloadsView() {
  const { tasks, pause, resume, remove, moveQueueItem } = useDownloadStore();
  const { games } = useGamesStore();
  const downloadPath = useSettingsStore((state) => state.downloadPath);
  const { t } = useI18n();

  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'error');

  const openDownloadsFolder = async () => {
    try {
      await invoke('open_folder_path', { path: downloadPath });
    } catch {
      toast.error('Failed to open download folder.');
    }
  };

  const openTaskFolder = async (task: DownloadTask) => {
    try {
      const targetPath = task.savePath ?? downloadPath;
      if (!targetPath) {
        toast.error('No folder path available for this download yet.');
        return;
      }
      await invoke('reveal_in_folder', { path: targetPath });
    } catch {
      toast.error('Failed to open item folder.');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header
        className="flex h-16 shrink-0 items-center px-8 border-b border-border bg-background z-50 relative"
      >
        <SidebarTrigger className="mr-4" />
        <h2 className="text-lg font-semibold tracking-tight">{t('downloads.title', { count: activeTasks.length })}</h2>
        <Button variant="outline" className="ml-auto" onClick={openDownloadsFolder}>
          {t('downloads.openDownloadFolder')}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto w-full" style={{ willChange: 'scroll-position', transform: 'translateZ(0)', scrollBehavior: 'smooth' }}>
        {activeTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-24 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-2">
              <Download className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-medium tracking-tight">{t('downloads.noActiveTitle')}</h3>
            <p className="text-muted-foreground max-w-sm">
              {t('downloads.noActiveDescription')}
            </p>
          </div>
        ) : (
          <div className="p-8 space-y-4">
            {activeTasks.map((task) => {
              const game = games.find(g => g.slug === task.gameSlug);

              return (
                 <DownloadTaskRow
                   key={task.id}
                   task={task}
                   game={game}
                   onPause={pause}
                   onResume={resume}
                   onRemove={remove}
                   onOpenFolder={openTaskFolder}
                   onMoveQueue={moveQueueItem}
                 />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
