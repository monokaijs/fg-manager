import { Play, Pause, Trash, Image as ImageIcon, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";
import { CachedImage } from "@/components/ui/cached-image";
import { type DownloadTask } from "@/lib/downloads/types";
import { type GameBrief } from "@/store/useGamesStore";

interface DownloadTaskRowProps {
  task: DownloadTask;
  game?: GameBrief;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string, deleteFiles: boolean) => void;
}

export function DownloadTaskRow({ task, game, onPause, onResume, onRemove }: DownloadTaskRowProps) {
  const title = game ? game.title : task.name;
  const thumbnail = game ? game.postImage : null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3 group relative hover:border-primary/30 transition-colors">
      <div className="flex justify-between items-start gap-4">
        <Link to={game ? `/games/view/${game.slug}` : "#"} className="flex gap-4 items-center flex-1 min-w-0 pr-4">
          {thumbnail ? (
            <CachedImage src={thumbnail} alt={title} className="w-16 h-16 rounded object-cover flex-shrink-0 bg-muted" />
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
            <Button variant="outline" size="icon" onClick={() => onResume(task.id)}>
              <Play className="w-4 h-4 opacity-70" />
            </Button>
          ) : (
            <Button variant="outline" size="icon" onClick={() => onPause(task.id)}>
              <Pause className="w-4 h-4 opacity-70" />
            </Button>
          )}
          <Button variant="destructive" size="icon" className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground opacity-70 hover:opacity-100 transition-opacity" onClick={() => onRemove(task.id, true)}>
            <Trash className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <Progress value={task.progress * 100} className="h-2 w-full mt-1 bg-muted overflow-hidden" />
    </div>
  );
}
