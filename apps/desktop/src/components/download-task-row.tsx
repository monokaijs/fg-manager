import { Play, Pause, Trash, Image as ImageIcon, Users, FolderOpen, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";
import { useI18n } from "@/i18n/useI18n";

import { type DownloadTask } from "@/lib/downloads/types";
import { type GameBrief } from "@/store/useGamesStore";

interface DownloadTaskRowProps {
  task: DownloadTask;
  game?: GameBrief;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string, deleteFiles: boolean) => void;
  onOpenFolder: (task: DownloadTask) => void;
  onMoveQueue: (id: string, direction: 'up' | 'down') => void;
}

export function DownloadTaskRow({ task, game, onPause, onResume, onRemove, onOpenFolder, onMoveQueue }: DownloadTaskRowProps) {
  const title = game ? game.title : task.name;
  const thumbnail = game ? game.postImage : null;
  const { t } = useI18n();

  const statusLabel = t(`common.status.${task.status}`);
  const etaLabel = task.eta > 0 ? t('downloads.minutes', { count: Math.ceil(task.eta / 60) }) : t('common.unknown');

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3 group relative hover:border-primary/30 transition-colors">
      <div className="flex justify-between items-start gap-4">
        <Link to={game ? `/games/view/${game.slug}` : "#"} className="flex gap-4 items-center flex-1 min-w-0 pr-4">
          {thumbnail ? (
            <img loading="lazy" decoding="async" src={thumbnail} alt={title} className="w-16 h-16 rounded object-cover flex-shrink-0 bg-muted" />
          ) : (
            <div className="w-16 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground/30">
              <ImageIcon className="w-8 h-8" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-base truncate group-hover:text-primary transition-colors">{title}</h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <span className="capitalize text-primary font-medium">{statusLabel}</span>
              <span>•</span>
              <span>{formatBytes(task.downloaded)} / {formatBytes(task.totalSize)}</span>
              {task.status === 'downloading' && (
                <>
                  <span>•</span>
                  <span>{formatBytes(task.downloadSpeed)}/s</span>
                  <span>•</span>
                  <span>{t('downloads.eta')}: {etaLabel}</span>
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
          <Button variant="outline" size="icon" title={t('common.moveUp')} onClick={() => onMoveQueue(task.id, 'up')}>
            <ArrowUp className="w-4 h-4 opacity-70" />
          </Button>
          <Button variant="outline" size="icon" title={t('common.moveDown')} onClick={() => onMoveQueue(task.id, 'down')}>
            <ArrowDown className="w-4 h-4 opacity-70" />
          </Button>
          <Button variant="outline" size="icon" title={t('common.openFolder')} onClick={() => onOpenFolder(task)}>
            <FolderOpen className="w-4 h-4 opacity-70" />
          </Button>
          {task.status === 'paused' || task.status === 'error' ? (
            <Button variant="outline" size="icon" title={t('common.resume')} onClick={() => onResume(task.id)}>
              <Play className="w-4 h-4 opacity-70" />
            </Button>
          ) : (
            <Button variant="outline" size="icon" title={t('common.pause')} onClick={() => onPause(task.id)}>
              <Pause className="w-4 h-4 opacity-70" />
            </Button>
          )}
          <Button variant="destructive" size="icon" title={t('common.cancel')} className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground opacity-70 hover:opacity-100 transition-opacity" onClick={() => onRemove(task.id, true)}>
            <Trash className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <Progress value={task.progress * 100} className="h-2 w-full mt-1 bg-muted overflow-hidden" />
    </div>
  );
}
