import { Download, Play, Pause, Trash, Image as ImageIcon, Users } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Link } from "react-router-dom";
import { useDownloadStore } from "@/stores/downloadStore";
import { useGamesStore } from "@/store/useGamesStore";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function DownloadsView() {
  const { tasks, pause, resume, remove } = useDownloadStore();
  const { games } = useGamesStore();

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      <header
        data-tauri-drag-region
        className="flex h-16 shrink-0 items-center px-8 border-b border-border bg-background/95 backdrop-blur z-50 sticky top-0 transition-[padding] duration-200"
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
            const title = game ? game.title : task.name;
            const thumbnail = game ? game.postImage : null;

            return (
            <div key={task.id} className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3 group relative hover:border-primary/30 transition-colors">
              <div className="flex justify-between items-start gap-4">
                <Link to={game ? `/games/view/${game.slug}` : "#"} className="flex gap-4 items-center flex-1 min-w-0 pr-4">
                  {thumbnail ? (
                    <img src={thumbnail} alt={title} className="w-16 h-16 rounded object-cover flex-shrink-0 bg-muted" />
                  ) : (
                    <div className="w-16 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground/30">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-base truncate group-hover:text-primary transition-colors">{title}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                      <span className="capitalize text-primary font-medium">{task.status}</span>
                      <span>•</span>
                      <span>{formatBytes(task.downloaded)} / {formatBytes(task.totalSize)}</span>
                      {task.status === 'downloading' && (
                        <>
                          <span>•</span>
                          <span>{formatBytes(task.downloadSpeed)}/s</span>
                          <span>•</span>
                          <span>ETA: {task.eta > 0 ? `${Math.ceil(task.eta / 60)} min` : 'Unknown'}</span>
                          {task.peers !== undefined && task.seeds !== undefined && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {task.seeds} / {task.peers}</span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-2 mt-2">
                  {task.status === 'paused' || task.status === 'error' ? (
                    <Button variant="outline" size="icon" onClick={() => resume(task.id)}>
                      <Play className="w-4 h-4 opacity-70" />
                    </Button>
                  ) : (
                    <Button variant="outline" size="icon" onClick={() => pause(task.id)}>
                      <Pause className="w-4 h-4 opacity-70" />
                    </Button>
                  )}
                  <Button variant="destructive" size="icon" className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground opacity-70 hover:opacity-100 transition-opacity" onClick={() => remove(task.id, true)}>
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Progress value={task.progress * 100} className="h-2 w-full mt-1 bg-muted overflow-hidden" />
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
