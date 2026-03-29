import { Download } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDownloadStore } from "@/stores/downloadStore";
import { useGamesStore } from "@/store/useGamesStore";
import { DownloadTaskRow } from "@/components/download-task-row";

export default function DownloadsView() {
  const { tasks, pause, resume, remove } = useDownloadStore();
  const { games } = useGamesStore();

  return (
    <div className="flex flex-col h-full bg-background relative">
      <header
        data-tauri-drag-region
        className="flex h-16 shrink-0 items-center px-8 border-b border-border bg-background z-50 sticky top-0 transition-[padding] duration-200"
      >
        <SidebarTrigger className="mr-4" />
        <h2 className="text-lg font-semibold tracking-tight">Downloads ({tasks.length})</h2>
      </header>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-24 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-2">
            <Download className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-medium tracking-tight">No active downloads</h3>
          <p className="text-muted-foreground max-w-sm">
            Torrents and magnet links currently downloading will appear here.
          </p>
        </div>
      ) : (
        <div className="p-8 space-y-4 overflow-y-auto">
          {tasks.map((task) => {
            const game = games.find(g => g.slug === task.gameSlug);

            return (
               <DownloadTaskRow key={task.id} task={task} game={game} onPause={pause} onResume={resume} onRemove={remove} />
            );
          })}
        </div>
      )}
    </div>
  );
}
